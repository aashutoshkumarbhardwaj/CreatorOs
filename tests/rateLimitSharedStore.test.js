const fs = require('fs');
const path = require('path');

describe('Shared Redis rate-limit store', () => {
    const ORIGINAL_REDIS_URI = process.env.REDIS_URI;
    const ORIGINAL_REDIS_URL = process.env.REDIS_URL;

    afterEach(() => {
        if (ORIGINAL_REDIS_URI === undefined) {
            delete process.env.REDIS_URI;
        } else {
            process.env.REDIS_URI = ORIGINAL_REDIS_URI;
        }
        if (ORIGINAL_REDIS_URL === undefined) {
            delete process.env.REDIS_URL;
        } else {
            process.env.REDIS_URL = ORIGINAL_REDIS_URL;
        }
        jest.resetModules();
    });

    afterAll(() => {
        try {
            const { getRedisClient } = require('../utils/rateLimitStore');
            getRedisClient()?.disconnect();
        } catch (e) {
            // ignore
        }
    });

    test('returns undefined (in-memory fallback) when Redis is not configured', () => {
        delete process.env.REDIS_URI;
        delete process.env.REDIS_URL;
        const { createRateLimitStore } = require('../utils/rateLimitStore');
        expect(createRateLimitStore()).toBeUndefined();
    });

    test('returns a RedisStore when REDIS_URI is configured', () => {
        process.env.REDIS_URI = 'redis://localhost:6379';
        const { createRateLimitStore, getRedisClient } = require('../utils/rateLimitStore');
        const store = createRateLimitStore();
        expect(store).toBeDefined();
        expect(store.constructor.name).toBe('RedisStore');
        expect(getRedisClient()).toBeDefined();
        // Stop the lazy client so pending script preloads do not keep Jest alive.
        getRedisClient().disconnect();
    });

    test('rate limiters use the shared Redis store', () => {
        const source = fs.readFileSync(path.join(__dirname, '../middleware/rateLimiters.js'), 'utf8');
        expect(source).toContain("require('../utils/rateLimitStore')");
        expect(source.match(/store: createRateLimitStore\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    });

    test('analytics refresh limiter uses the shared Redis store', () => {
        const source = fs.readFileSync(path.join(__dirname, '../routes/analytics.js'), 'utf8');
        expect(source).toContain('rateLimitStore');
        expect(source).toContain('store: createRateLimitStore()');
    });

    test('QR write limiter uses the shared Redis store', () => {
        const source = fs.readFileSync(path.join(__dirname, '../controller/qrCodeController.js'), 'utf8');
        expect(source).toContain("require('../utils/rateLimitStore')");
        expect(source).toContain('store: createRateLimitStore()');
    });

    test('bio click cooldown in index.js prefers shared Redis with in-memory fallback', () => {
        const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
        expect(source).toContain('redisClickClient');
        expect(source).toContain('isClickCooldownActive');
        expect(source).toContain('click:cooldown:');
        expect(source).toMatch(/redisClickClient\.set\([\s\S]*?"NX"/);
    });
});
