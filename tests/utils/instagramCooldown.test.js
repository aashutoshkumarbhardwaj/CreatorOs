const {
    DEFAULT_INSTAGRAM_LOOKUP_COOLDOWN_SECONDS,
    getInstagramLookupCooldownSeconds,
} = require('../../utils/instagramCooldown');

describe('instagram cooldown config', () => {
    const originalValue = process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS;

    afterEach(() => {
        if (originalValue === undefined) {
            delete process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS;
        } else {
            process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS = originalValue;
        }
    });

    test('uses the default when the env var is missing', () => {
        delete process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS;

        expect(getInstagramLookupCooldownSeconds()).toBe(DEFAULT_INSTAGRAM_LOOKUP_COOLDOWN_SECONDS);
    });

    test('uses the default for invalid values', () => {
        process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS = 'not-a-number';

        expect(getInstagramLookupCooldownSeconds()).toBe(DEFAULT_INSTAGRAM_LOOKUP_COOLDOWN_SECONDS);
    });

    test('uses the default for negative values', () => {
        process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS = '-5';

        expect(getInstagramLookupCooldownSeconds()).toBe(DEFAULT_INSTAGRAM_LOOKUP_COOLDOWN_SECONDS);
    });

    test('uses the default for zero unless explicitly allowed', () => {
        process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS = '0';

        expect(getInstagramLookupCooldownSeconds()).toBe(DEFAULT_INSTAGRAM_LOOKUP_COOLDOWN_SECONDS);
        expect(getInstagramLookupCooldownSeconds({ allowZero: true })).toBe(0);
    });

    test('returns positive numeric values', () => {
        process.env.INSTAGRAM_LOOKUP_COOLDOWN_SECONDS = '45';

        expect(getInstagramLookupCooldownSeconds()).toBe(45);
    });
});
