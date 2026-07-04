const IORedis = require('ioredis');

const REDIS_URI = process.env.REDIS_URI;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds
const MAX_RESET_ATTEMPTS = 3;
const RESET_LOCKOUT_DURATION = 60 * 60; // 1 hour in seconds

let redisClient = null;

if (REDIS_URI) {
    redisClient = new IORedis(REDIS_URI, {
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        lazyConnect: true,
    });
}

function getLoginAttemptKey(identifier) {
    return `login_attempts:${identifier.toLowerCase()}`;
}

function getResetAttemptKey(identifier) {
    return `reset_attempts:${identifier.toLowerCase()}`;
}

async function getFailedLoginAttempts(identifier) {
    if (!redisClient) {
        console.warn('[LoginAttempts] Redis not configured, skipping attempt tracking');
        return 0;
    }

    try {
        const key = getLoginAttemptKey(identifier);
        const attempts = parseInt(await redisClient.get(key) || '0');
        return attempts;
    } catch (error) {
        console.error('[LoginAttempts] Error fetching failed attempts:', error);
        return 0;
    }
}

async function getRemainingLoginLockoutTime(identifier) {
    if (!redisClient) {
        return 0;
    }

    try {
        const key = getLoginAttemptKey(identifier);
        const ttl = await redisClient.ttl(key);
        return ttl > 0 ? ttl : 0;
    } catch (error) {
        console.error('[LoginAttempts] Error fetching lockout TTL:', error);
        return 0;
    }
}

async function checkIfLoginLocked(identifier) {
    const attempts = await getFailedLoginAttempts(identifier);
    return attempts >= MAX_LOGIN_ATTEMPTS;
}

async function recordFailedLoginAttempt(identifier) {
    if (!redisClient) {
        console.warn('[LoginAttempts] Redis not configured, skipping failed attempt recording');
        return;
    }

    try {
        const key = getLoginAttemptKey(identifier);
        const attempts = await redisClient.incr(key);

        if (attempts === 1) {
            await redisClient.expire(key, LOGIN_LOCKOUT_DURATION);
        }
    } catch (error) {
        console.error('[LoginAttempts] Error recording failed attempt:', error);
    }
}

async function clearLoginAttempts(identifier) {
    if (!redisClient) {
        return;
    }

    try {
        const key = getLoginAttemptKey(identifier);
        await redisClient.del(key);
    } catch (error) {
        console.error('[LoginAttempts] Error clearing attempts:', error);
    }
}

async function getFailedResetAttempts(identifier) {
    if (!redisClient) {
        return 0;
    }

    try {
        const key = getResetAttemptKey(identifier);
        const attempts = parseInt(await redisClient.get(key) || '0');
        return attempts;
    } catch (error) {
        console.error('[PasswordReset] Error fetching failed attempts:', error);
        return 0;
    }
}

async function getRemainingResetLockoutTime(identifier) {
    if (!redisClient) {
        return 0;
    }

    try {
        const key = getResetAttemptKey(identifier);
        const ttl = await redisClient.ttl(key);
        return ttl > 0 ? ttl : 0;
    } catch (error) {
        console.error('[PasswordReset] Error fetching lockout TTL:', error);
        return 0;
    }
}

async function checkIfResetLocked(identifier) {
    const attempts = await getFailedResetAttempts(identifier);
    return attempts >= MAX_RESET_ATTEMPTS;
}

async function recordFailedResetAttempt(identifier) {
    if (!redisClient) {
        console.warn('[PasswordReset] Redis not configured, skipping failed attempt recording');
        return;
    }

    try {
        const key = getResetAttemptKey(identifier);
        const attempts = await redisClient.incr(key);

        if (attempts === 1) {
            await redisClient.expire(key, RESET_LOCKOUT_DURATION);
        }
    } catch (error) {
        console.error('[PasswordReset] Error recording failed attempt:', error);
    }
}

async function clearResetAttempts(identifier) {
    if (!redisClient) {
        return;
    }

    try {
        const key = getResetAttemptKey(identifier);
        await redisClient.del(key);
    } catch (error) {
        console.error('[PasswordReset] Error clearing attempts:', error);
    }
}

module.exports = {
    checkIfLoginLocked,
    recordFailedLoginAttempt,
    clearLoginAttempts,
    getFailedLoginAttempts,
    getRemainingLoginLockoutTime,
    checkIfResetLocked,
    recordFailedResetAttempt,
    clearResetAttempts,
    getFailedResetAttempts,
    getRemainingResetLockoutTime,
    MAX_LOGIN_ATTEMPTS,
    LOGIN_LOCKOUT_DURATION,
    MAX_RESET_ATTEMPTS,
    RESET_LOCKOUT_DURATION,
};
