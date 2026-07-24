const { preferencesSchema } = require('../../middleware/validators');

describe('preferencesSchema', () => {
    test('accepts valid partial preference updates', () => {
        const result = preferencesSchema.safeParse({
            appearanceMode: 'dark',
            motionEffects: false,
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            appearanceMode: 'dark',
            motionEffects: false,
        });
    });

    test('rejects invalid enum values', () => {
        const result = preferencesSchema.safeParse({
            appearanceMode: 'neon',
        });

        expect(result.success).toBe(false);
    });

    test('rejects unknown keys and string booleans', () => {
        const result = preferencesSchema.safeParse({
            soundCues: 'false',
            extra: 'field',
        });

        expect(result.success).toBe(false);
    });
});
