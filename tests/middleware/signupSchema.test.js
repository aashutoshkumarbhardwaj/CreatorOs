const { signupSchema } = require('../../middleware/validators');

describe('signupSchema', () => {
    test('rejects whitespace-only names', () => {
        const result = signupSchema.safeParse({
            name: '   ',
            email: 'creator@example.com',
            password: 'Password123!',
        });

        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe('Name is required');
    });

    test('trims valid names', () => {
        const result = signupSchema.safeParse({
            name: '  Creator Name  ',
            email: 'creator@example.com',
            password: 'Password123!',
        });

        expect(result.success).toBe(true);
        expect(result.data.name).toBe('Creator Name');
    });
});
