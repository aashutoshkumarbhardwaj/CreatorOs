const cron = require('node-cron');
const ScheduledContent = require('../model/scheduledContent');

const INSTANCE_ID = process.env.INSTANCE_ID || `web-${process.pid}`;

async function publishToPlatform(item) {
    // Stub: Simulate contacting a remote social platform (e.g., Twitter, Instagram)
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate random failure (10% chance) for testing robustness, or force success
            const succeed = Math.random() > 0.1;
            if (succeed) {
                resolve({ remoteId: `post_${Date.now()}_${Math.floor(Math.random() * 1000)}` });
            } else {
                reject(new Error("Provider API timeout or rejection"));
            }
        }, 500);
    });
}

async function publishDueContent() {
    const now = new Date();
    let publishedCount = 0;

    while (true) {
        // Atomically claim one due item by moving it to "publishing"
        const item = await ScheduledContent.findOneAndUpdate(
            {
                status: 'scheduled',
                scheduledAt: { $lte: now },
            },
            {
                $set: {
                    status: 'publishing',
                    publishedBy: INSTANCE_ID,
                },
            },
            {
                new: true,
            }
        );

        if (!item) break;

        try {
            // Attempt to publish
            const providerResult = await publishToPlatform(item);

            // If successful, finalize status
            item.status = 'published';
            item.publishedAt = new Date();
            item.remoteId = providerResult.remoteId;
            await item.save();
            publishedCount++;
        } catch (error) {
            // If failed, record failure
            item.status = 'failed';
            item.failureReason = error.message;
            await item.save();
        }
    }

    return publishedCount;
}

function startContentPublishWorker() {
    // Skip scheduling under the Jest test env, local mock DB, or Vercel serverless.
    // In Vercel, cron jobs must be triggered via Vercel Cron (HTTP endpoint).
    if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_DB === 'true' || process.env.VERCEL === '1') return;

    // Schedule the job to run every minute.
    // The `fireOnStart` option is false by default, so it will wait for the
    // first minute to tick over before its initial run.
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

module.exports = { startContentPublishWorker, publishDueContent };
