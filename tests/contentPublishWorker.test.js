const mongoose = require('mongoose');
const { publishDueContent } = require('../workers/contentPublishWorker');
const ScheduledContent = require('../model/scheduledContent');

describe('Content Publish Worker', () => {
    const originalEnv = process.env.TEST_PUBLISH_FAIL;

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
});
