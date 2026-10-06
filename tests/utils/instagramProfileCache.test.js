const {
  getInstagramProfileCacheTtlSeconds,
  DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS,
} = require("../../utils/instagramCooldown");

describe("instagram profile cache ttl", () => {
  const saved = process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS;

  afterEach(() => {
    if (saved === undefined) delete process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS;
    else process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = saved;
  });

  it("defaults to 600 when unset", () => {
    delete process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS;
    expect(getInstagramProfileCacheTtlSeconds()).toBe(
      DEFAULT_INSTAGRAM_PROFILE_CACHE_TTL_SECONDS
    );
  });

  it("falls back on bad values", () => {
    process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = "abc";
    expect(getInstagramProfileCacheTtlSeconds()).toBe(600);
    process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = "-5";
    expect(getInstagramProfileCacheTtlSeconds()).toBe(600);
  });

  it("uses the configured value", () => {
    process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = "120";
    expect(getInstagramProfileCacheTtlSeconds()).toBe(120);
  });

  it("floors fractional values", () => {
    process.env.INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = "90.9";
    expect(getInstagramProfileCacheTtlSeconds()).toBe(90);
  });
});
