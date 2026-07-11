const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Connect to Redis (defaults to localhost:6379, or REDIS_URL if provided)
const redisOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
};

const redisConnection = new Redis(redisOptions);

// Check if Redis is reachable, if not, handle it gracefully
redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
});

// Create queues
const emailQueue = new Queue('emailQueue', { connection: redisConnection });
const aiTaskQueue = new Queue('aiTaskQueue', { connection: redisConnection });

module.exports = {
    emailQueue,
    aiTaskQueue,
    redisConnection
};
