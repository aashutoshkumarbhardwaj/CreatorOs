const { updateProfileSchema } = require('../../middleware/validators');

describe('updateProfileSchema', () => {
    test('rejects empty profile update payloads', () => {
        const result = updateProfileSchema.safeParse({});

        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe('At least one profile field is required');
    });

    test('accepts valid partial profile updates', () => {
        const result = updateProfileSchema.safeParse({ bio: 'Updated creator bio' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ bio: 'Updated creator bio' });
    });
});
