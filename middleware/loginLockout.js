const Redis = require('ioredis');

// Tracks failed login/reset attempts per-identifier (not per-IP) so a
// brute-force attempt spread across many IPs still gets locked out. Falls
// back to an in-memory Map when REDIS_URI isn't configured, matching the
// pattern used in controller/instagramController.js.
const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL;
const redis = REDIS_URI
    ? new Redis(REDIS_URI, {
        connectTimeout: 5000,
        lazyConnect: true,
    })
    : null;

if (redis) {
    redis.on('error', (error) => {
        console.warn(`[LoginLockout] Redis error: ${error.message}`);
    });
}

const memoryStore = new Map();

function memoryGet(key) {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        memoryStore.delete(key);
        return null;
    }
    return entry;
}

class AccountLockedError extends Error {
    constructor(message, retryAfterSeconds) {
        super(message);
        this.name = 'AccountLockedError';
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

function buildAttemptTracker(prefix, maxAttempts, lockoutSeconds) {
    const keyFor = (identifier) => `${prefix}:${identifier.toLowerCase().trim()}`;

    async function checkAttempts(identifier) {
        const key = keyFor(identifier);

        if (redis) {
            const attempts = parseInt(await redis.get(key) || '0', 10);
            if (attempts >= maxAttempts) {
                const ttl = await redis.ttl(key);
                throw new AccountLockedError(
                    `Account locked. Try again in ${Math.ceil(ttl / 60)} minutes.`,
                    ttl > 0 ? ttl : lockoutSeconds
                );
            }
            return;
        }

        const entry = memoryGet(key);
        if (entry && entry.count >= maxAttempts) {
            const ttl = Math.ceil((entry.expiresAt - Date.now()) / 1000);
            throw new AccountLockedError(
                `Account locked. Try again in ${Math.ceil(ttl / 60)} minutes.`,
                ttl
            );
        }
    }

    async function recordFailure(identifier) {
        const key = keyFor(identifier);

        if (redis) {
            const attempts = await redis.incr(key);
            if (attempts === 1) await redis.expire(key, lockoutSeconds);
            return attempts;
        }

        const entry = memoryGet(key) || { count: 0, expiresAt: Date.now() + lockoutSeconds * 1000 };
        entry.count += 1;
        memoryStore.set(key, entry);
        return entry.count;
    }

    async function resetAttempts(identifier) {
        const key = keyFor(identifier);
        if (redis) {
            await redis.del(key);
            return;
        }
        memoryStore.delete(key);
    }

    return { checkAttempts, recordFailure, resetAttempts };
}

// 5 failed logins -> 15 minute lockout, tracked per email/username.
const loginAttempts = buildAttemptTracker('login_attempts', 5, 15 * 60);

// 5 password reset requests -> 15 minute cooldown, tracked per email.
// Prevents using the reset flow to enumerate accounts or spam reset emails.
const resetAttempts = buildAttemptTracker('reset_attempts', 5, 15 * 60);

module.exports = {
    AccountLockedError,
    loginAttempts,
    resetAttempts,
};
