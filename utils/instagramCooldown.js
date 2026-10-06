const DEFAULT_INSTAGRAM_LOOKUP_COOLDOWN_SECONDS = 30;
const DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = 600;

function getInstagramLookupCooldownSeconds(options = {}) {
    const { allowZero = false } = options;
    const value = Number(process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS);

    if (Number.isFinite(value) && value > 0) {
        return value;
    }

    if (allowZero && value === 0) {
        return 0;
    }

    return DEFAULT_INSTAGRAM_LOOKUP_COOLDOWN_SECONDS;
}

module.exports = {
    DEFAULT_INSTAGRAM_LOOKUP_COOLDOWN_SECONDS,
    DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS,
    getInstagramLookupCooldownSeconds,
    getInstagramProfileCacheTtlSeconds,
};

function getInstagramProfileCacheTtlSeconds() {
    const value = Number(process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS);
    if (Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }
    return DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS;
}
