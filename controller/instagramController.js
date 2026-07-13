const { fetchInstagramProfile, InstagramProfileError, validateUsername } = require('../utils/instagramProfileService');
const Redis = require('ioredis');

const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL;
const redis = REDIS_URI
    ? new Redis(REDIS_URI, {
        connectTimeout: 5000,
        lazyConnect: true,
    })
    : null;
const memoryStore = new Map();

if (redis) {
    redis.on('error', (error) => {
        console.warn(`[InstagramProfile] Redis error: ${error.message}`);
    });
}

/**
 * @function getCooldownSeconds
 * @description Automatically generated JSDoc for getCooldownSeconds
 * @returns {any}
 */
function getCooldownSeconds() {
    const value = Number(process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS || 30);
    return Number.isFinite(value) && value >= 0 ? value : 30;
}

/**
 * @function getLookupKey
 * @description Automatically generated JSDoc for getLookupKey
 * @returns {any}
 */
function getLookupKey(req) {
    return req.user?.id || req.ip || 'anonymous';
}

function getMemoryValue(key) {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        memoryStore.delete(key);
        return null;
    }
    return entry.value;
}

function setMemoryValue(key, value, ttlSeconds) {
    memoryStore.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}

/**
 * @function assertLookupAllowed
 * @description Enforces a distributed per-user cooldown using Redis (SET NX EX),
 * replacing the previous in-memory Map so cooldowns are shared across all
 * Node.js instances and serverless workers.
 * @returns {Promise<void>}
 */
async function assertLookupAllowed(req) {
    const cooldownSeconds = getCooldownSeconds();

    if (cooldownSeconds === 0) {
        return;
    }

    const lookupKey = `ig:cooldown:${getLookupKey(req)}`;
    if (!redis) {
        const expiresAt = getMemoryValue(lookupKey);
        if (expiresAt) {
            const retryAfter = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
            throw new InstagramProfileError(
                'RATE_LIMITED',
                `Please wait ${retryAfter} seconds before fetching another Instagram profile.`,
                429,
                { retryAfter }
            );
        }

        setMemoryValue(lookupKey, Date.now() + cooldownSeconds * 1000, cooldownSeconds);
        return;
    }

    const result = await redis.set(lookupKey, '1', 'EX', cooldownSeconds, 'NX');

    if (!result) {
        const ttl = await redis.ttl(lookupKey);
        const retryAfter = ttl > 0 ? ttl : cooldownSeconds;
        throw new InstagramProfileError(
            'RATE_LIMITED',
            `Please wait ${retryAfter} seconds before fetching another Instagram profile.`,
            429,
            { retryAfter }
        );
    }
}

/**
 * @function sendInstagramError
 * @description Formats and sends a standardized error response for Instagram API failures.
 * @returns {any}
 */
function sendInstagramError(res, error) {
    if (error instanceof InstagramProfileError) {
        return res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        });
    }

    return res.status(500).json({
        success: false,
        error: {
            code: 'TEMPORARY_FETCH_ERROR',
            message: 'Unable to fetch Instagram profile right now. Please try again later.',
        },
    });
}

/**
 * @function getInstagramProfile
 * @description Retrieves public profile information from Instagram.
 * Checks Redis cache first (30-min TTL) to avoid redundant network requests,
 * then enforces a distributed per-user cooldown before hitting Instagram.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function getInstagramProfile(req, res) {
    try {
        const username = validateUsername(req.query.username);

        await assertLookupAllowed(req);

        const cacheKey = `ig:profile:${username}`;
        const cachedProfile = redis
            ? await redis.get(cacheKey)
            : getMemoryValue(cacheKey);

        if (cachedProfile) {
            return res.json({
                success: true,
                data: JSON.parse(cachedProfile),
            });
        }

        const profile = await fetchInstagramProfile(username);

        if (redis) {
            await redis.set(cacheKey, JSON.stringify(profile), 'EX', 1800); // 30 minutes TTL
        } else {
            setMemoryValue(cacheKey, JSON.stringify(profile), 1800);
        }

        return res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        return sendInstagramError(res, error);
    }
}

module.exports = {
    getInstagramProfile,
};
