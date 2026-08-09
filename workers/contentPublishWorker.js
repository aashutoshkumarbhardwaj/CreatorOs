const cron = require('node-cron');
const ScheduledContent = require('../model/scheduledContent');

const INSTANCE_ID = process.env.INSTANCE_ID || `web-${process.pid}`;

async function publishToPlatform(item) {
    if (item.shouldFail === true || process.env.TEST_PUBLISH_FAIL === 'true') {
        throw new Error('Platform API delivery failed: Invalid authentication token or missing media payload.');
    }

    // Real platform adapters (auth token, media upload, platform API calls) are
    // not implemented. Gate the feature behind a config flag and surface a
    // "not_implemented" status instead of fabricating a postId.
    if (process.env.CONTENT_PUBLISHING_ENABLED !== 'true') {
        return { success: false, reason: 'not_implemented' };
    }

    throw new Error('Platform API delivery failed: no publishing adapter is configured.');
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
            if (publishResult.success) {
                await ScheduledContent.findByIdAndUpdate(claimedItem._id, {
                    $set: {
                        status: 'published',
                        publishedAt: new Date(),
                        platformPostId: publishResult.postId,
                        errorMessage: null,
                    },
                });
                publishedCount++;
            } else {
                const errorMessage = `Content publishing not implemented: ${publishResult.reason || 'unknown'}.`;
                console.warn(`[ContentPublishWorker] ${errorMessage}`);
                await ScheduledContent.findByIdAndUpdate(claimedItem._id, {
                    $set: {
                        status: 'failed',
                        errorMessage,
                    },
                });
            }
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
