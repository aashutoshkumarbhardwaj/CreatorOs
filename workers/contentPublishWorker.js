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
 *
 * Every transition is a single atomic, state-guarded write. The previous
 * implementation parked exhausted rows in `scheduled` first and flipped them to
 * `failed` in a second write; in that gap another worker could claim and publish
 * the row (a publish beyond MAX_PUBLISH_ATTEMPTS) and the second write then
 * overwrote its state, and a crash in the gap left the row retrying forever.
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ reclaimed: number, failed: number }>}
 */
async function reclaimStalePublishingLeases(now = new Date()) {
    const leaseCutoff = new Date(now.getTime() - PUBLISH_LEASE_MS);
    let reclaimed = 0;
    let failed = 0;

    const leaseExpired = {
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

    // 1) Out of attempts: straight to `failed`, never visible as `scheduled`.
    while (true) {
        const exhausted = await ScheduledContent.findOneAndUpdate(
            { ...leaseExpired, publishAttempts: { $gte: MAX_PUBLISH_ATTEMPTS } },
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

    // 2) Attempts left: hand back to the scheduler. `$not: { $gte }` also matches
    //    legacy rows that have no publishAttempts field yet.
    while (true) {
        const stale = await ScheduledContent.findOneAndUpdate(
            { ...leaseExpired, publishAttempts: { $not: { $gte: MAX_PUBLISH_ATTEMPTS } } },
            {
                $set: {
                    status: 'scheduled',
                    publishedBy: null,
                    publishingStartedAt: null,
                },
            },
            { new: false }
        );
        if (!stale) break;
        reclaimed++;
    }

    return { reclaimed, failed };
}

/**
 * Fenced write for a claim this worker holds. publishAttempts is incremented on
 * every claim, so (status, publishedBy, publishAttempts) identifies exactly one
 * claim. If the lease expired and the row was reclaimed or re-claimed meanwhile,
 * the filter no longer matches and the stale worker cannot overwrite the new
 * owner's state.
 */
function finishClaim(claimedItem, fields) {
    return ScheduledContent.findOneAndUpdate(
        {
            _id: claimedItem._id,
            status: 'publishing',
            publishedBy: INSTANCE_ID,
            publishAttempts: claimedItem.publishAttempts,
        },
        { $set: fields },
        { new: true }
    );
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

        let publishResult;
        try {
            publishResult = await publishToPlatform(claimedItem);
        } catch (error) {
            console.error(`[ContentPublishWorker] Platform publish failed for item ${claimedItem._id}:`, error.message);
            try {
                const marked = await finishClaim(claimedItem, {
                    status: 'failed',
                    errorMessage: error.message,
                    publishingStartedAt: null,
                });
                if (!marked) {
                    console.warn(`[ContentPublishWorker] Lease for item ${claimedItem._id} was lost; failure not recorded.`);
                }
            } catch (writeError) {
                console.error(`[ContentPublishWorker] Could not record failure for item ${claimedItem._id}:`, writeError.message);
            }
            continue;
        }

        // The platform accepted the post. A failed bookkeeping write must never be
        // reported as a publish failure, so it is handled outside the try above.
        try {
            const finished = await finishClaim(claimedItem, {
                status: 'published',
                publishedAt: new Date(),
                platformPostId: publishResult.postId,
                errorMessage: null,
                publishingStartedAt: null,
            });
            if (finished) {
                publishedCount++;
            } else {
                console.warn(`[ContentPublishWorker] Lease for item ${claimedItem._id} was lost after publishing (post ${publishResult.postId}); state left to the current owner.`);
            }
        } catch (writeError) {
            console.error(`[ContentPublishWorker] Published item ${claimedItem._id} (post ${publishResult.postId}) but could not record it:`, writeError.message);
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
