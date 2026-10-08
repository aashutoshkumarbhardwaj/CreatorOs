const cron = require('node-cron');
const ScheduledContent = require('../model/scheduledContent');

const INSTANCE_ID = process.env.INSTANCE_ID || `web-${process.pid}`;
const PUBLISH_LEASE_MS = Number(process.env.PUBLISH_LEASE_MS) || 10 * 60 * 1000;
const MAX_PUBLISH_ATTEMPTS = Number(process.env.MAX_PUBLISH_ATTEMPTS) || 3;

async function publishToPlatform(item) {
    if (item.shouldFail === true || process.env.TEST_PUBLISH_FAIL === 'true') {
        throw new Error('Platform API delivery failed: Invalid authentication token or missing media payload.');
    }

    const platform = item.platform || 'instagram';
    const remoteId = `${platform}_post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return { postId: remoteId };
}

/**
 * Reclaim documents stuck in `publishing` after the lease TTL expires
 * (crashed worker, killed process, etc.). Resets to `scheduled` for another
 * attempt, or `failed` once max attempts are exhausted.
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ reclaimed: number, failed: number }>}
 */
async function reclaimStalePublishingLeases(now = new Date()) {
    const leaseCutoff = new Date(now.getTime() - PUBLISH_LEASE_MS);
    let reclaimed = 0;
    let failed = 0;

    // The attempts check and the status transition happen inside ONE atomic
    // aggregation-pipeline update. The document never passes through a
    // transient `scheduled` state, so a concurrent publishDueContent() on
    // another instance cannot claim an exhausted item and publish it past
    // MAX_PUBLISH_ATTEMPTS, and a second write can never clobber its result.
    const exhausted = { $gte: [{ $ifNull: ['$publishAttempts', 0] }, MAX_PUBLISH_ATTEMPTS] };

    while (true) {
        const stale = await ScheduledContent.findOneAndUpdate(
            {
                status: 'publishing',
                $or: [
                    { publishingStartedAt: { $lte: leaseCutoff } },
                    {
                        $and: [
                            {
                                $or: [
                                    { publishingStartedAt: null },
                                    { publishingStartedAt: { $exists: false } },
                                ],
                            },
                            { updatedAt: { $lte: leaseCutoff } },
                        ],
                    },
                ],
            },
            [
                {
                    $set: {
                        status: { $cond: [exhausted, 'failed', 'scheduled'] },
                        errorMessage: {
                            $cond: [
                                exhausted,
                                `Publishing lease expired after ${MAX_PUBLISH_ATTEMPTS} attempts`,
                                '$errorMessage',
                            ],
                        },
                        publishedBy: null,
                        publishingStartedAt: null,
                    },
                },
            ],
            { new: true }
        );

        if (!stale) break;

        if (stale.status === 'failed') {
            failed++;
        } else {
            reclaimed++;
        }
    }

    return { reclaimed, failed };
}

async function publishDueContent() {
    const now = new Date();
    let publishedCount = 0;

    await reclaimStalePublishingLeases(now);

    // Use two-phase claim & publish to prevent duplicate delivery or false status updates
    while (true) {
        const claimedItem = await ScheduledContent.findOneAndUpdate(
            {
                status: 'scheduled',
                scheduledAt: { $lte: now },
            },
            {
                $set: {
                    status: 'publishing',
                    publishedBy: INSTANCE_ID,
                    publishingStartedAt: now,
                },
                $inc: { publishAttempts: 1 },
            },
            { new: true }
        );

        if (!claimedItem) break;

        // Fencing token: only the worker that still owns this exact lease may
        // write the final state (a reclaimed/re-claimed item must not be overwritten).
        const ownsLease = {
            _id: claimedItem._id,
            status: 'publishing',
            publishedBy: INSTANCE_ID,
            publishingStartedAt: claimedItem.publishingStartedAt,
        };

        try {
            const publishResult = await publishToPlatform(claimedItem);
            const finalized = await ScheduledContent.updateOne(ownsLease, {
                $set: {
                    status: 'published',
                    publishedAt: new Date(),
                    platformPostId: publishResult.postId,
                    errorMessage: null,
                    publishingStartedAt: null,
                },
            });
            if (finalized.modifiedCount > 0) publishedCount++;
        } catch (error) {
            console.error(`[ContentPublishWorker] Platform publish failed for item ${claimedItem._id}:`, error.message);
            await ScheduledContent.updateOne(ownsLease, {
                $set: {
                    status: 'failed',
                    errorMessage: error.message,
                    publishingStartedAt: null,
                },
            });
        }
    }

    return publishedCount;
}

function startContentPublishWorker() {
    // Skip scheduling under the Jest test env, local mock DB, or Vercel serverless.
    if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_DB === 'true' || process.env.VERCEL === '1') return;

    cron.schedule('* * * * *', async () => {
        try {
            const publishedCount = await publishDueContent();
            if (publishedCount > 0) {
                console.log(`[ContentPublishWorker] Published ${publishedCount} scheduled item(s).`);
            }
        } catch (error) {
            console.error('[ContentPublishWorker] Failed to publish due content:', error.message);
        }
    });
}

module.exports = {
    startContentPublishWorker,
    publishDueContent,
    publishToPlatform,
    reclaimStalePublishingLeases,
    PUBLISH_LEASE_MS,
    MAX_PUBLISH_ATTEMPTS,
};
