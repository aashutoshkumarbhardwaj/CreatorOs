const cron = require("node-cron");
const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");
const { fetchInstagramAnalytics } = require("../utils/instagramApi");

// Runs every 6 hours
cron.schedule("0 */6 * * *", async () => {
    console.log("[AnalyticsWorker] Starting scheduled refresh...");

    try {
        const creators = await Creator.find({});

        for (const creator of creators) {
            let fetchedData;
            try {
                fetchedData = await fetchInstagramAnalytics(creator);
            } catch (err) {
                console.error(`[AnalyticsWorker] Skipping creator ${creator.username} due to API error:`, err.message);
                continue;
            }

            // Get last snapshot for growth comparison
            const lastSnapshot = await AnalyticsSnapshot.findOne(
                { creatorId: creator._id },
                {},
                { sort: { createdAt: -1 } }
            );

            // Save new snapshot
            const newSnapshot = await AnalyticsSnapshot.create({
                creatorId: creator._id,
                platform: creator.platform,
                ...fetchedData,
                snapshotDate: new Date(),
            });

            // Save engagement history (growth delta)
            if (lastSnapshot) {
                await EngagementHistory.create({
                    creatorId: creator._id,
                    snapshotId: newSnapshot._id,
                    followersGrowth: fetchedData.followers - lastSnapshot.followers,
                    likesGrowth: fetchedData.totalLikes - lastSnapshot.totalLikes,
                    commentsGrowth: fetchedData.totalComments - lastSnapshot.totalComments,
                    engagementRateDelta: fetchedData.engagementRate - lastSnapshot.engagementRate,
                });
            }

            // Update lastRefreshedAt on creator
            await Creator.findByIdAndUpdate(creator._id, {
                lastRefreshedAt: new Date(),
            });

            console.log(`[AnalyticsWorker] Refreshed creator: ${creator.username}`);
        }

        console.log("[AnalyticsWorker] Refresh complete.");
    } catch (err) {
        console.error("[AnalyticsWorker] Error during refresh:", err.message);
    }
});