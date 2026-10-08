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
 * Filter matching `publishing` documents whose lease has expired
 * (crashed worker, killed process, etc.).
 * @param {Date} leaseCutoff
 */
function staleLeaseFilter(leaseCutoff) {
    return {
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
    };
}

/**
 * Reclaim documents stuck in `publishing` after the lease TTL expires.
 *
 * Every transition is a single atomic findOneAndUpdate so a document is never
 * visible in an intermediate state to other instances:
 *   1. leases that already used up all attempts go straight to `failed`
 *      (they must never pass through `scheduled`, otherwise another instance
 *      could claim and publish them beyond MAX_PUBLISH_ATTEMPTS, and the
 *      follow-up `failed` write would then clobber a successful publish);
 *   2. the remaining expired leases go back to `scheduled` for another attempt.
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ reclaimed: number, failed: number }>}
 */
async function reclaimStalePublishingLeases(now = new Date()) {
    const leaseCutoff = new Date(now.getTime() - PUBLISH_LEASE_MS);
    const staleFilter = staleLeaseFilter(leaseCutoff);
    let reclaimed = 0;
    let failed = 0;

    while (true) {
        const exhausted = await ScheduledContent.findOneAndUpdate(
            { ...staleFilter, publishAttempts: { $gte: MAX_PUBLISH_ATTEMPTS } },
            {
                $set: {
                    status: 'failed',
                    errorMessage: `Publishing lease expired after ${MAX_PUBLISH_ATTEMPTS} attempts`,
                    publishingStartedAt: null,
                    publishedBy: null,
                },
            },
            { new: false }
        );

        if (!exhausted) break;
        failed++;
    }

    while (true) {
        const retryable = await ScheduledContent.findOneAndUpdate(
            // `$not: { $gte }` also matches legacy documents without the counter.
            { ...staleFilter, publishAttempts: { $not: { $gte: MAX_PUBLISH_ATTEMPTS } } },
            {
                $set: {
                    status: 'scheduled',
                    publishedBy: null,
                    publishingStartedAt: null,
                },
            },
            { new: false }
        );

        if (!retryable) break;
        reclaimed++;
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
                    // Stamp each claim with its own time. Reusing the timestamp captured at the
                    // start of the run would make later claims in a long run look stale already.
                    publishingStartedAt: new Date(),
                },
                $inc: { publishAttempts: 1 },
            },
            { new: true }
        );

        if (!claimedItem) break;

        // Fence all follow-up writes to this exact claim. publishAttempts is bumped on every
        // claim, so if the lease was reclaimed (and possibly re-claimed or cancelled) while
        // this worker was talking to the platform, these writes become no-ops instead of
        // overwriting the newer state.
        const claimFence = {
            _id: claimedItem._id,
            status: 'publishing',
            publishAttempts: claimedItem.publishAttempts,
        };

        try {
            const publishResult = await publishToPlatform(claimedItem);
            const finalized = await ScheduledContent.findOneAndUpdate(
                claimFence,
                {
                    $set: {
                        status: 'published',
                        publishedAt: new Date(),
                        platformPostId: publishResult.postId,
                        errorMessage: null,
                        publishingStartedAt: null,
                    },
                },
                { new: true }
            );

            if (finalized) {
                publishedCount++;
            } else {
                console.warn(
                    `[ContentPublishWorker] Lease for item ${claimedItem._id} was lost before the publish result ` +
                    `(${publishResult.postId}) could be recorded; leaving the newer state untouched.`
                );
            }
        } catch (error) {
            console.error(`[ContentPublishWorker] Platform publish failed for item ${claimedItem._id}:`, error.message);
            await ScheduledContent.findOneAndUpdate(claimFence, {
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
