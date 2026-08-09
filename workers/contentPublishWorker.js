const cron = require('node-cron');
const ScheduledContent = require('../model/scheduledContent');

const INSTANCE_ID = process.env.INSTANCE_ID || `web-${process.pid}`;

async function publishToPlatform(item) {
    if (item.shouldFail === true || process.env.TEST_PUBLISH_FAIL === 'true') {
        throw new Error('Platform API delivery failed: Invalid authentication token or missing media payload.');
    }

    const platform = item.platform || 'instagram';
    const remoteId = `${platform}_post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return { postId: remoteId };
}

async function publishDueContent() {
    const now = new Date();
    let publishedCount = 0;

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
                },
            },
            { new: true }
        );

        if (!claimedItem) break;

        try {
            const publishResult = await publishToPlatform(claimedItem);
            await ScheduledContent.findByIdAndUpdate(claimedItem._id, {
                $set: {
                    status: 'published',
                    publishedAt: new Date(),
                    platformPostId: publishResult.postId,
                    errorMessage: null,
                },
            });
            publishedCount++;
        } catch (error) {
            console.error(`[ContentPublishWorker] Platform publish failed for item ${claimedItem._id}:`, error.message);
            await ScheduledContent.findByIdAndUpdate(claimedItem._id, {
                $set: {
                    status: 'failed',
                    errorMessage: error.message,
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

module.exports = { startContentPublishWorker, publishDueContent, publishToPlatform };
