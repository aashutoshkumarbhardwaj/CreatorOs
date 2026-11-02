const {
    getInstagramProfileCacheTtlSeconds,
    DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS,
} = require('../../utils/instagramProfileCacheTtl');

describe('getInstagramProfileCacheTtlSeconds', () => {
    const originalValue = process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS;

    afterEach(() => {
        if (originalValue === undefined) {
            delete process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS;
        } else {
            process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = originalValue;
        }
    });

    test('returns the default when unset', () => {
        delete process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS;
        expect(getInstagramProfileCacheTtlSeconds()).toBe(DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS);
    });

    test('returns the default when not a number', () => {
        process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = 'not-a-number';
        expect(getInstagramProfileCacheTtlSeconds()).toBe(DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS);
    });

    test('returns the default for a negative value', () => {
        process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = '-5';
        expect(getInstagramProfileCacheTtlSeconds()).toBe(DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS);
    });

    test('returns the default for 0 when allowZero is not set', () => {
        process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = '0';
        expect(getInstagramProfileCacheTtlSeconds()).toBe(DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS);
    });

    test('returns 0 when allowZero is set, to disable caching', () => {
        process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = '0';
        expect(getInstagramProfileCacheTtlSeconds({ allowZero: true })).toBe(0);
    });

    test('returns a valid configured value', () => {
        process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = '45';
        expect(getInstagramProfileCacheTtlSeconds()).toBe(45);
    });
});
