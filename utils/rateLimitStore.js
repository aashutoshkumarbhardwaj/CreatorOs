const IORedis = require('ioredis');
const { RedisStore } = require('rate-limit-redis');

let redisClient = null;

// express-rate-limit requires a real Redis connection (raw commands), so only
// REDIS_URI/REDIS_URL qualify here - not the Upstash REST client.
function getRedisClient() {
    if (redisClient) return redisClient;
    const redisUrl = process.env.REDIS_URI || process.env.REDIS_URL;
    if (!redisUrl) return null;

    redisClient = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        lazyConnect: true,
        enableReadyCheck: false,
        retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    redisClient.on('error', (error) => {
        console.error(`❌ Rate Limit Redis Connection Error: ${error.message}`);
    });
    return redisClient;
}

// Create a Redis-backed store so rate limits are shared across all app
// replicas behind the nginx load balancer instead of being enforced
// per-process (which multiplies effective limits by the replica count).
// Returns undefined when Redis is not configured, letting express-rate-limit
// fall back to its in-memory store (per-process semantics).
function createRateLimitStore() {
    const client = getRedisClient();
    if (!client) return undefined;
    const store = new RedisStore({
        sendCommand: (...args) => client.call(...args),
    });
    // The store preloads its Lua scripts in the constructor. The preload is an
    // optimization; increment() re-loads the script if needed, so a failed
    // preload is harmless and must not become an unhandled rejection.
    store.incrementScriptSha?.catch(() => {});
    store.getScriptSha?.catch(() => {});
    return store;
}

module.exports = { createRateLimitStore, getRedisClient };
