const cron = require("node-cron");
const {
    processDueScheduledNotifications,
} = require("../services/smartNotificationService");

/**
 * Flush quiet-hours / otherwise deferred notifications whose scheduledFor has passed.
 */
function startScheduledNotificationWorker() {
    // Skip under Jest, local mock DB, or Vercel serverless (same guards as contentPublishWorker).
    if (
        process.env.NODE_ENV === "test" ||
        process.env.USE_MOCK_DB === "true" ||
        process.env.VERCEL === "1"
    ) {
        return;
    }

    cron.schedule("* * * * *", async () => {
        try {
            const result = await processDueScheduledNotifications();
            if (result.processed > 0) {
                console.log(
                    `[ScheduledNotificationWorker] Processed ${result.processed} due notification(s) (sent=${result.sent}, failed=${result.failed}).`
                );
            }
        } catch (error) {
            console.error(
                "[ScheduledNotificationWorker] Failed to process due notifications:",
                error.message
            );
        }
    });
}

module.exports = {
    startScheduledNotificationWorker,
    processDueScheduledNotifications,
};
