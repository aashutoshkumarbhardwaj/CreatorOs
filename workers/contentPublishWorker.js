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
 * Filter matching documents whose publishing lease has expired (crashed worker,
 * killed process, hung network call, ...). Documents written before
 * `publishingStartedAt` existed fall back to `updatedAt`.
 */
function staleLeaseFilter(leaseCutoff) {
    return {
        status: 'publishing',
        $or: [
            { publishingStartedAt: { $lte: leaseCutoff } },
            { publishingStartedAt: null, updatedAt: { $lte: leaseCutoff } },
        ],
    };
}

/**
 * Reclaim documents stuck in `publishing` after the lease TTL expires.
 *
 * Each document moves straight from `publishing` to its final state
 * (`scheduled` for another attempt, or `failed` once the attempt budget is
 * spent) in ONE atomic write whose predicate is re-checked by the database at
 * write time. A document is therefore never exposed as `scheduled` unless it
 * really is eligible for another attempt, and a concurrent worker that has
 * already re-claimed it is never overwritten.
 *
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ reclaimed: number, failed: number }>}
 */
async function reclaimStalePublishingLeases(now = new Date()) {
    const leaseCutoff = new Date(now.getTime() - PUBLISH_LEASE_MS);
    const stale = staleLeaseFilter(leaseCutoff);

    // Attempt budget exhausted -> terminal failure (never touches `scheduled`).
    const exhausted = await ScheduledContent.updateMany(
        { ...stale, publishAttempts: { $gte: MAX_PUBLISH_ATTEMPTS } },
        {
            $set: {
                status: 'failed',
                errorMessage: `Publishing lease expired after ${MAX_PUBLISH_ATTEMPTS} attempts`,
                publishingStartedAt: null,
                publishedBy: null,
            },
        }
    );

    // Budget left (or counter missing on legacy documents) -> another attempt.
    const retriable = await ScheduledContent.updateMany(
        { ...stale, publishAttempts: { $not: { $gte: MAX_PUBLISH_ATTEMPTS } } },
        {
            $set: {
                status: 'scheduled',
                publishedBy: null,
                publishingStartedAt: null,
            },
        }
    );

    return {
        reclaimed: retriable.modifiedCount || 0,
        failed: exhausted.modifiedCount || 0,
    };
}

/**
 * Fencing filter for every write made on behalf of a claim. `publishAttempts`
 * is incremented atomically by each claim, so (publishedBy, publishAttempts)
 * uniquely identifies the claim that currently owns the document. A worker
 * whose lease was reclaimed matches nothing and cannot overwrite the newer
 * claim's state.
 */
function claimFilter(claimedItem) {
    return {
        _id: claimedItem._id,
        status: 'publishing',
        publishedBy: INSTANCE_ID,
        publishAttempts: claimedItem.publishAttempts,
    };
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
                    // Lease starts when THIS item is claimed, not when the batch
                    // started; otherwise later items in a long batch look stale
                    // to other instances while still being published.
                    publishingStartedAt: new Date(),
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
            const failed = await ScheduledContent.updateOne(claimFilter(claimedItem), {
                $set: {
                    status: 'failed',
                    errorMessage: error.message,
                    publishingStartedAt: null,
                },
            });
            if (!failed.matchedCount) {
                console.warn(`[ContentPublishWorker] Lease for item ${claimedItem._id} was reclaimed before the failure could be recorded; leaving the newer claim untouched.`);
            }
            continue;
        }

        const finalized = await ScheduledContent.updateOne(claimFilter(claimedItem), {
            $set: {
                status: 'published',
                publishedAt: new Date(),
                platformPostId: publishResult.postId,
                errorMessage: null,
                publishingStartedAt: null,
            },
        });

        if (finalized.matchedCount) {
            publishedCount++;
        } else {
            console.warn(`[ContentPublishWorker] Lease for item ${claimedItem._id} expired and was reclaimed while publishing (remote post ${publishResult.postId}); not overwriting the newer claim.`);
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
