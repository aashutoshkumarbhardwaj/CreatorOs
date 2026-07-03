const Redis = require('ioredis');

// Caches each creator's own profile document (fetched via User.findById on
// nearly every page render - dashboard, analytics, bio editor, settings,
// etc.) so repeat visits within the TTL window skip the DB round-trip.
// Falls back to an in-memory Map when REDIS_URI isn't configured, matching
// the pattern already used in controller/instagramController.js.
const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL;
const redis = REDIS_URI
    ? new Redis(REDIS_URI, {
        connectTimeout: 5000,
        lazyConnect: true,
    })
    : null;

if (redis) {
    redis.on('error', (error) => {
        console.warn(`[CreatorProfileCache] Redis error: ${error.message}`);
    });
}

const memoryStore = new Map();
const PROFILE_TTL = 300; // 5 minutes

function cacheKey(userId) {
    return `profile:${userId}`;
}

/**
 * Fetches a user's profile document, serving from cache when available.
 * @param {string} userId
 * @param {import('mongoose').Model} User - the User model (passed in to avoid a require cycle)
 * @returns {Promise<{ doc: object|null, hit: boolean }>}
 */
async function getCachedUserProfile(userId, User) {
    const key = cacheKey(userId);

    if (redis) {
        const cached = await redis.get(key);
        if (cached) return { doc: JSON.parse(cached), hit: true };

        const doc = await User.findById(userId).lean();
        if (doc) await redis.setex(key, PROFILE_TTL, JSON.stringify(doc));
        return { doc, hit: false };
    }

    const entry = memoryStore.get(key);
    if (entry && entry.expiresAt > Date.now()) {
        return { doc: entry.doc, hit: true };
    }

    const doc = await User.findById(userId).lean();
    if (doc) memoryStore.set(key, { doc, expiresAt: Date.now() + PROFILE_TTL * 1000 });
    return { doc, hit: false };
}

/**
 * Invalidates a user's cached profile. Call after any write to the User
 * document (settings updates, profile picture change, etc.) so the next
 * read reflects the change instead of serving stale cached data.
 * @param {string} userId
 */
async function invalidateProfileCache(userId) {
    const key = cacheKey(userId);
    if (redis) {
        await redis.del(key);
        return;
    }
    memoryStore.delete(key);
}

module.exports = { getCachedUserProfile, invalidateProfileCache };
