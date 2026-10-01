const mongoose = require('mongoose');
const {
    publishDueContent,
    reclaimStalePublishingLeases,
    PUBLISH_LEASE_MS,
    MAX_PUBLISH_ATTEMPTS,
} = require('../workers/contentPublishWorker');
const ScheduledContent = require('../model/scheduledContent');

describe('Content Publish Worker', () => {
    afterEach(() => {
        delete process.env.TEST_PUBLISH_FAIL;
    });

    it('publishes content whose scheduledAt has passed, sets status to published, and assigns platformPostId', async () => {
        const userId = new mongoose.Types.ObjectId();
        const dueItem = await ScheduledContent.create({
            userId,
            caption: 'Due for publishing',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 60 * 1000), // 1 minute in the past
            status: 'scheduled',
        });

        const publishedCount = await publishDueContent();
        expect(publishedCount).toBe(1);

        const refreshed = await ScheduledContent.findById(dueItem._id);
        expect(refreshed.status).toBe('published');
        expect(refreshed.publishedAt).toBeInstanceOf(Date);
        expect(refreshed.platformPostId).toBeDefined();
        expect(typeof refreshed.platformPostId).toBe('string');
        expect(refreshed.errorMessage).toBeNull();
        expect(refreshed.publishingStartedAt).toBeNull();
        expect(refreshed.publishAttempts).toBe(1);
    });

    it('marks item as failed and records errorMessage when platform delivery fails', async () => {
        const userId = new mongoose.Types.ObjectId();
        const failingItem = await ScheduledContent.create({
            userId,
            caption: 'Will fail publishing',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 60 * 1000),
            status: 'scheduled',
        });

        process.env.TEST_PUBLISH_FAIL = 'true';

        const publishedCount = await publishDueContent();
        expect(publishedCount).toBe(0);

        const refreshed = await ScheduledContent.findById(failingItem._id);
        expect(refreshed.status).toBe('failed');
        expect(refreshed.errorMessage).toContain('Platform API delivery failed');
    });

    it('does not publish content scheduled in the future', async () => {
        const userId = new mongoose.Types.ObjectId();
        const futureItem = await ScheduledContent.create({
            userId,
            caption: 'Not due yet',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            status: 'scheduled',
        });

        await publishDueContent();

        const refreshed = await ScheduledContent.findById(futureItem._id);
        expect(refreshed.status).toBe('scheduled');
        expect(refreshed.publishedAt).toBeUndefined();
    });

    it('does not re-publish content that is already published, failed, or cancelled', async () => {
        const userId = new mongoose.Types.ObjectId();
        const alreadyPublished = await ScheduledContent.create({
            userId,
            caption: 'Already published',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 60 * 1000),
            status: 'published',
            publishedAt: new Date(Date.now() - 30 * 1000),
        });
        const cancelled = await ScheduledContent.create({
            userId,
            caption: 'Cancelled',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 60 * 1000),
            status: 'cancelled',
        });

        const publishedCount = await publishDueContent();
        expect(publishedCount).toBe(0);

        expect((await ScheduledContent.findById(alreadyPublished._id)).status).toBe('published');
        expect((await ScheduledContent.findById(cancelled._id)).status).toBe('cancelled');
    });

    it('reclaims stale publishing leases and republishes them', async () => {
        const userId = new mongoose.Types.ObjectId();
        const staleStartedAt = new Date(Date.now() - PUBLISH_LEASE_MS - 60 * 1000);
        const stuck = await ScheduledContent.create({
            userId,
            caption: 'Stuck in publishing',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 5 * 60 * 1000),
            status: 'publishing',
            publishedBy: 'dead-worker',
            publishingStartedAt: staleStartedAt,
            publishAttempts: 1,
        });
        const fresh = await ScheduledContent.create({
            userId,
            caption: 'Actively publishing',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 5 * 60 * 1000),
            status: 'publishing',
            publishedBy: 'live-worker',
            publishingStartedAt: new Date(),
            publishAttempts: 1,
        });

        const publishedCount = await publishDueContent();
        expect(publishedCount).toBe(1);

        const refreshedStuck = await ScheduledContent.findById(stuck._id);
        expect(refreshedStuck.status).toBe('published');
        expect(refreshedStuck.publishAttempts).toBe(2);

        const refreshedFresh = await ScheduledContent.findById(fresh._id);
        expect(refreshedFresh.status).toBe('publishing');
        expect(refreshedFresh.publishedBy).toBe('live-worker');
    });

    it('marks stale publishing as failed after max attempts', async () => {
        const userId = new mongoose.Types.ObjectId();
        const staleStartedAt = new Date(Date.now() - PUBLISH_LEASE_MS - 60 * 1000);
        const exhausted = await ScheduledContent.create({
            userId,
            caption: 'Exhausted publishing attempts',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 5 * 60 * 1000),
            status: 'publishing',
            publishedBy: 'dead-worker',
            publishingStartedAt: staleStartedAt,
            publishAttempts: MAX_PUBLISH_ATTEMPTS,
        });

        const result = await reclaimStalePublishingLeases();
        expect(result.failed).toBe(1);
        expect(result.reclaimed).toBe(0);

        const refreshed = await ScheduledContent.findById(exhausted._id);
        expect(refreshed.status).toBe('failed');
        expect(refreshed.errorMessage).toContain('Publishing lease expired');
    });

    describe('lease fencing and atomic reclaim', () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        function dueItem(overrides = {}) {
            return ScheduledContent.create({
                userId: new mongoose.Types.ObjectId(),
                caption: 'Lease test',
                timezone: 'UTC',
                scheduledAt: new Date(Date.now() - 60 * 1000),
                status: 'scheduled',
                ...overrides,
            });
        }

        // Simulates another instance reclaiming this item's expired lease and
        // re-claiming it, right after the current worker claimed it.
        function stealClaimAfterFirstClaim() {
            const realClaim = ScheduledContent.findOneAndUpdate.bind(ScheduledContent);
            let stolen = false;
            return jest.spyOn(ScheduledContent, 'findOneAndUpdate').mockImplementation(async (...args) => {
                const claimed = await realClaim(...args);
                if (claimed && !stolen) {
                    stolen = true;
                    await ScheduledContent.updateOne(
                        { _id: claimed._id },
                        { $set: { publishedBy: 'other-instance' }, $inc: { publishAttempts: 1 } }
                    );
                }
                return claimed;
            });
        }

        it('does not let a worker whose lease was reclaimed overwrite the newer claim with "published"', async () => {
            const item = await dueItem();
            const spy = stealClaimAfterFirstClaim();

            const publishedCount = await publishDueContent();
            spy.mockRestore();

            expect(publishedCount).toBe(0);
            const refreshed = await ScheduledContent.findById(item._id);
            expect(refreshed.status).toBe('publishing');
            expect(refreshed.publishedBy).toBe('other-instance');
            expect(refreshed.publishAttempts).toBe(2);
            expect(refreshed.platformPostId).toBeNull();
        });

        it('does not let a worker whose lease was reclaimed overwrite the newer claim with "failed"', async () => {
            const item = await dueItem();
            process.env.TEST_PUBLISH_FAIL = 'true';
            const spy = stealClaimAfterFirstClaim();

            await publishDueContent();
            spy.mockRestore();

            const refreshed = await ScheduledContent.findById(item._id);
            expect(refreshed.status).toBe('publishing');
            expect(refreshed.publishedBy).toBe('other-instance');
            expect(refreshed.errorMessage).toBeNull();
        });

        it('starts each item\'s lease at its own claim time, not at the start of the batch', async () => {
            await dueItem();
            await dueItem();
            await dueItem();

            const realClaim = ScheduledContent.findOneAndUpdate.bind(ScheduledContent);
            const leaseStarts = [];
            const spy = jest.spyOn(ScheduledContent, 'findOneAndUpdate').mockImplementation(async (...args) => {
                const claimed = await realClaim(...args);
                if (claimed) {
                    leaseStarts.push(args[1].$set.publishingStartedAt.getTime());
                    await sleep(40); // each publish takes a while
                }
                return claimed;
            });

            await publishDueContent();
            spy.mockRestore();

            expect(leaseStarts).toHaveLength(3);
            expect(leaseStarts[1] - leaseStarts[0]).toBeGreaterThanOrEqual(30);
            expect(leaseStarts[2] - leaseStarts[0]).toBeGreaterThanOrEqual(60);
        });

        it('reclaims stale leases on legacy documents that have no publishAttempts counter', async () => {
            const legacy = await dueItem({
                status: 'publishing',
                publishedBy: 'dead-worker',
                publishingStartedAt: new Date(Date.now() - PUBLISH_LEASE_MS - 60 * 1000),
            });
            await ScheduledContent.updateOne({ _id: legacy._id }, { $unset: { publishAttempts: 1 } });

            const result = await reclaimStalePublishingLeases();

            expect(result).toEqual({ reclaimed: 1, failed: 0 });
            const refreshed = await ScheduledContent.findById(legacy._id);
            expect(refreshed.status).toBe('scheduled');
            expect(refreshed.publishedBy).toBeNull();
        });

        it('never exposes an exhausted stale item as "scheduled" while reclaiming it', async () => {
            const exhausted = await dueItem({
                status: 'publishing',
                publishedBy: 'dead-worker',
                publishingStartedAt: new Date(Date.now() - PUBLISH_LEASE_MS - 60 * 1000),
                publishAttempts: MAX_PUBLISH_ATTEMPTS,
            });

            // Observe the stored status right after every write issued by the reclaim.
            // Any intermediate "scheduled" state is claimable by another instance.
            const observed = [];
            const spies = ['findOneAndUpdate', 'findByIdAndUpdate', 'updateOne', 'updateMany'].map((method) => {
                const real = ScheduledContent[method].bind(ScheduledContent);
                return jest.spyOn(ScheduledContent, method).mockImplementation(async (...args) => {
                    const result = await real(...args);
                    observed.push((await ScheduledContent.findById(exhausted._id)).status);
                    return result;
                });
            });

            const result = await reclaimStalePublishingLeases();
            spies.forEach((spy) => spy.mockRestore());

            expect(result).toEqual({ reclaimed: 0, failed: 1 });
            expect(observed.length > 0).toBe(true);
            expect(observed.every((status) => status === 'failed')).toBe(true);

            const refreshed = await ScheduledContent.findById(exhausted._id);
            expect(refreshed.status).toBe('failed');
            expect(refreshed.publishAttempts).toBe(MAX_PUBLISH_ATTEMPTS);
        });
    });
});
