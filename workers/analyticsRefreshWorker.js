const cron = require("node-cron");
const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");

// Runs every 6 hours
cron.schedule("0 */6 * * *", async () => {
    console.log("[AnalyticsWorker] Starting scheduled refresh...");

    try {
        const creators = await Creator.find({});

        for (const creator of creators) {
            // TODO: Replace with real platform API call (e.g. Instagram Graph API)
            const mockFetchedData = {
                followers: Math.floor(Math.random() * 10000),
                following: Math.floor(Math.random() * 1000),
                totalPosts: Math.floor(Math.random() * 500),
                totalLikes: Math.floor(Math.random() * 50000),
                totalComments: Math.floor(Math.random() * 5000),
                totalViews: Math.floor(Math.random() * 100000),
                engagementRate: parseFloat((Math.random() * 10).toFixed(2)),
            };

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
                ...mockFetchedData,
                snapshotDate: new Date(),
            });

            // Save engagement history (growth delta)
            if (lastSnapshot) {
                await EngagementHistory.create({
                    creatorId: creator._id,
                    snapshotId: newSnapshot._id,
                    followersGrowth: mockFetchedData.followers - lastSnapshot.followers,
                    likesGrowth: mockFetchedData.totalLikes - lastSnapshot.totalLikes,
                    commentsGrowth: mockFetchedData.totalComments - lastSnapshot.totalComments,
                    engagementRateDelta: mockFetchedData.engagementRate - lastSnapshot.engagementRate,
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