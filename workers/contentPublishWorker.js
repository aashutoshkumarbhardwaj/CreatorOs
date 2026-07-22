const cron = require('node-cron');
const ScheduledContent = require('../model/scheduledContent');

const INSTANCE_ID = process.env.INSTANCE_ID || `web-${process.pid}`;
const DEFAULT_PUBLISH_BATCH_SIZE = 100;

function getPublishBatchSize() {
    const parsed = Number.parseInt(process.env.CONTENT_PUBLISH_BATCH_SIZE, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PUBLISH_BATCH_SIZE;
}

async function publishDueContent(options = {}) {
    const now = new Date();
    const batchSize = options.batchSize || getPublishBatchSize();
    let publishedCount = 0;

    // Use atomic findOneAndUpdate to prevent race conditions in multi-instance deployments
    while (publishedCount < batchSize) {
        const result = await ScheduledContent.findOneAndUpdate(
            {
                status: 'scheduled',
                scheduledAt: { $lte: now },
            },
            {
                $set: {
                    status: 'published',
                    publishedAt: now,
                    publishedBy: INSTANCE_ID,
                },
            },
            {
                new: true,
                sort: { scheduledAt: 1, _id: 1 },
            }
        );

        if (!result) break;
        publishedCount++;
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
    let isPublishing = false;

    cron.schedule('* * * * *', async () => {
        if (isPublishing) {
            console.warn('[ContentPublishWorker] Previous publish run is still active; skipping this tick.');
            return;
        }

        isPublishing = true;
        try {
            const publishedCount = await publishDueContent();
            if (publishedCount > 0) {
                console.log(`[ContentPublishWorker] Published ${publishedCount} scheduled item(s).`);
            }
        } catch (error) {
            console.error('[ContentPublishWorker] Failed to publish due content:', error.message);
        } finally {
            isPublishing = false;
        }
    });
}

module.exports = { startContentPublishWorker, publishDueContent, getPublishBatchSize, DEFAULT_PUBLISH_BATCH_SIZE };
