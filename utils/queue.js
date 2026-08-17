const { Queue } = require('bullmq');
const Redis = require('ioredis');

const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL;

function createFallbackQueue(name) {
    return {
        async add(jobName, jobData) {
            console.warn(`[Queue] Redis is not configured, skipping job "${jobName}" on queue "${name}".`);
            return { id: null, name: jobName, data: jobData };
        },
    };
}

let emailQueue = createFallbackQueue('emailQueue');
let aiTaskQueue = createFallbackQueue('aiTaskQueue');
let redisConnection = null;

if (REDIS_URI) {
    redisConnection = new Redis(REDIS_URI, {
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        lazyConnect: true,
    });

    redisConnection.on('error', (err) => {
        console.error('Redis connection error:', err);
    });

    emailQueue = new Queue('emailQueue', { connection: redisConnection });
    aiTaskQueue = new Queue('aiTaskQueue', { connection: redisConnection });
} else {
    console.warn('📦 BullMQ email/AI task queues disabled: REDIS_URI/REDIS_URL is not set.');
}

module.exports = {
    emailQueue,
    aiTaskQueue,
    redisConnection,
};
