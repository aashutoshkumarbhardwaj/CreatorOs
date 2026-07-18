const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URI || process.env.REDIS_URL;
const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function createUpstashRestClient(url, token) {
    const endpoint = url.replace(/\/$/, '');

    async function command(args) {
        const response = await fetch(`${endpoint}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([args]),
        });

        if (!response.ok) {
            throw new Error(`Upstash Redis request failed with status ${response.status}`);
        }

        const [result] = await response.json();
        if (result?.error) {
            throw new Error(result.error);
        }

        return result?.result;
    }

    return {
        mode: 'upstash-rest',
        get: (key) => command(['GET', key]),
        set: (key, value, ...options) => command(['SET', key, value, ...options]),
        setex: (key, seconds, value) => command(['SETEX', key, seconds, value]),
        incr: (key) => command(['INCR', key]),
        expire: (key, seconds) => command(['EXPIRE', key, seconds]),
        ttl: (key) => command(['TTL', key]),
        del: (key) => command(['DEL', key]),
        quit: async () => undefined,
    };
}

function createRedisClient() {
    if (redisUrl) {
        return new IORedis(redisUrl, {
            maxRetriesPerRequest: null,
            connectTimeout: 5000,
            lazyConnect: true,
            enableReadyCheck: false,
        });
    }

    if (upstashRestUrl && upstashRestToken) {
        return createUpstashRestClient(upstashRestUrl, upstashRestToken);
    }

    return null;
}

function hasRedisConfig() {
    return Boolean(redisUrl || (upstashRestUrl && upstashRestToken));
}

module.exports = {
    createRedisClient,
    hasRedisConfig,
};
