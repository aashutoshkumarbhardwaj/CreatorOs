const IORedis = require('ioredis');

const REDIS_URI = process.env.REDIS_URI;
const PROFILE_TTL = 5 * 60; // 5 minutes in seconds

let redisClient = null;

if (REDIS_URI) {
    redisClient = new IORedis(REDIS_URI, {
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        lazyConnect: true,
    });
}

function getProfileCacheKey(identifier) {
    return `profile:${identifier.toLowerCase()}`;
}

async function getProfileFromCache(identifier) {
    if (!redisClient) {
        return null;
    }

    try {
        const key = getProfileCacheKey(identifier);
        const cached = await redisClient.get(key);
        if (cached) {
            return { data: JSON.parse(cached), fromCache: true };
        }
        return null;
    } catch (error) {
        console.error('[ProfileCache] Error fetching from cache:', error);
        return null;
    }
}

async function setProfileInCache(identifier, profileData) {
    if (!redisClient) {
        console.warn('[ProfileCache] Redis not configured, skipping cache');
        return;
    }

    try {
        const key = getProfileCacheKey(identifier);
        await redisClient.setex(key, PROFILE_TTL, JSON.stringify(profileData));
    } catch (error) {
        console.error('[ProfileCache] Error setting cache:', error);
    }
}

async function invalidateProfileCache(identifier) {
    if (!redisClient) {
        return;
    }

    try {
        const key = getProfileCacheKey(identifier);
        await redisClient.del(key);
    } catch (error) {
        console.error('[ProfileCache] Error invalidating cache:', error);
    }
}

module.exports = {
    getProfileFromCache,
    setProfileInCache,
    invalidateProfileCache,
    PROFILE_TTL,
};
