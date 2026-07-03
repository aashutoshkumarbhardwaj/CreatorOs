const cron = require('node-cron');
const ScheduledContent = require('../model/scheduledContent');

// Runs every minute and publishes any content whose scheduledAt (stored in
// UTC) has passed. Comparing against `new Date()` (also UTC internally)
// means DST changes in the creator's local timezone can't cause an
// off-by-one-hour publish - the timezone field on the document is display
// metadata only, never used for the due-date comparison.
//
// NOTE: this only flips status to "published". There's no subscriber/
// notification system in this codebase yet (no subscriber model, no email
// dispatch for content updates), so the "notify subscribers" step from the
// issue's proposed solution isn't included - wiring it in would mean
// inventing a whole notification feature that's out of scope here.
async function publishDueContent() {
    const now = new Date();

    const dueContent = await ScheduledContent.find({
        status: 'scheduled',
        scheduledAt: { $lte: now },
    });

    for (const item of dueContent) {
        item.status = 'published';
        item.publishedAt = now;
        await item.save();
    }

    return dueContent.length;
}

function startContentPublishWorker() {
    // Skip scheduling under the Jest test env - node-cron's timer is a live
    // handle that never resolves, which otherwise leaves the test process
    // hanging and forces Jest to kill it ungracefully.
    if (process.env.NODE_ENV === 'test') return;

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
