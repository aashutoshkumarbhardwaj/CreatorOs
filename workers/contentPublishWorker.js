const cron = require('node-cron');
const ScheduledContent = require('../model/scheduledContent');

const INSTANCE_ID = process.env.INSTANCE_ID || `web-${process.pid}`;

async function publishDueContent() {
    const now = new Date();
    let publishedCount = 0;

    // Use atomic findOneAndUpdate to prevent race conditions in multi-instance deployments
    while (true) {
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
            }
        );

        if (!result) break;
        publishedCount++;
    }

    return publishedCount;
}

function startContentPublishWorker() {
    // Skip scheduling under the Jest test env - node-cron's timer is a live
    // handle that never resolves, which otherwise leaves the test process
    // hanging and forces Jest to kill it ungracefully.
    if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_DB === 'true') return;

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
