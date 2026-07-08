const cron = require("node-cron");
const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");
const { fetchInstagramAnalytics } = require("../utils/instagramApi");

const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL;

function createFallbackQueue() {
    return {
        async add(jobName, jobData) {
            console.warn(
                `[AnalyticsWorker] Redis is not configured, skipping job "${jobName}" for ${jobData?.username || 'unknown'}.`
            );
            return { id: null, name: jobName, data: jobData };
        }
    };
}

let analyticsQueue = createFallbackQueue();
let analyticsWorker = null;

if (!REDIS_URI) {
    console.warn("📦 Analytics refresh worker disabled because REDIS_URI is not set.");
} else {
    const redisConnection = new IORedis(REDIS_URI, {
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        lazyConnect: true,
    });

    analyticsQueue = new Queue("analytics-refresh", { connection: redisConnection });

    analyticsWorker = new Worker("analytics-refresh", async (job) => {
        const { creatorId } = job.data;

        const creator = await Creator.findById(creatorId);
        if (!creator) {
            throw new Error(`Creator not found: ${creatorId}`);
        }

        let fetchedData;
        try {
            fetchedData = await fetchInstagramAnalytics(creator);
        } catch (err) {
            console.error(`[AnalyticsWorker] API error for ${creator.username}:`, err.message);
            throw err;
        }

        const lastSnapshot = await AnalyticsSnapshot.findOne(
            { creatorId: creator._id },
            {},
            { sort: { createdAt: -1 } }
        );

        const newSnapshot = await AnalyticsSnapshot.create({
            creatorId: creator._id,
            platform: creator.platform,
            ...fetchedData,
            snapshotDate: new Date(),
        });

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

        await Creator.findByIdAndUpdate(creator._id, {
            lastRefreshedAt: new Date(),
        });

        console.log(`[AnalyticsWorker] Refreshed creator: ${creator.username}`);
    }, {
        connection: redisConnection,
        concurrency: 5,
    });

    analyticsWorker.on('completed', job => {
        console.log(`[AnalyticsWorker] Job completed for creator: ${job.data.username}`);
    });

    analyticsWorker.on('failed', (job, err) => {
        console.error(`[AnalyticsWorker] Job failed for creator: ${job?.data?.username}:`, err.message);
    });

    // Runs every 6 hours (disabled in test environment)
    if (process.env.NODE_ENV !== 'test') {
        cron.schedule("0 */6 * * *", async () => {
            console.log("[AnalyticsWorker] Scheduling refresh jobs...");

            try {
                const creators = await Creator.find({});

                for (const creator of creators) {
                    await analyticsQueue.add("refresh", {
                        creatorId: creator._id,
                        platform: creator.platform,
                        username: creator.username
                    }, {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000
                        }
                    });
                }

                console.log(`[AnalyticsWorker] Scheduled ${creators.length} refresh jobs.`);
            } catch (err) {
                console.error("[AnalyticsWorker] Error scheduling refresh:", err.message);
            }
        });
    }
}

module.exports = { analyticsQueue, analyticsWorker };
