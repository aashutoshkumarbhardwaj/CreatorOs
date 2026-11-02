const DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = 600;

/**
 * @function getInstagramProfileCacheTtlSeconds
 * @description Resolves the Instagram profile cache TTL from
 * INSTAGRAM_PROFILE_CACHE_TTL_SECONDS, falling back to the default for any
 * unset, non-numeric, or negative value. Pass { allowZero: true } to permit
 * 0, which disables caching entirely.
 * @param {{ allowZero?: boolean }} [options]
 * @returns {number}
 */
function getInstagramProfileCacheTtlSeconds(options = {}) {
    const { allowZero = false } = options;
    const value = Number(process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS);

    if (Number.isFinite(value) && value > 0) {
        return value;
    }

    if (allowZero && value === 0) {
        return 0;
    }

    return DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS;
}

module.exports = {
    DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS,
    getInstagramProfileCacheTtlSeconds,
};
