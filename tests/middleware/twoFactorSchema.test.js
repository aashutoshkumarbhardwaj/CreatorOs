const { twoFactorSchema } = require('../../middleware/validators');

describe('twoFactorSchema', () => {
    test('accepts boolean true and false values', () => {
        expect(twoFactorSchema.safeParse({ enabled: true }).success).toBe(true);
        expect(twoFactorSchema.safeParse({ enabled: false }).success).toBe(true);
    });

    test('rejects string boolean values', () => {
        const result = twoFactorSchema.safeParse({ enabled: 'false' });

        expect(result.success).toBe(false);
    });

    test('rejects unknown fields', () => {
        const result = twoFactorSchema.safeParse({ enabled: false, role: 'admin' });

        expect(result.success).toBe(false);
    });
});
