const { suggestionSchema } = require('../../middleware/validators');

describe('suggestionSchema', () => {
    test('rejects whitespace-only topics', () => {
        const result = suggestionSchema.safeParse({ topic: '   ' });

        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe('Topic is required');
    });

    test('trims valid topics', () => {
        const result = suggestionSchema.safeParse({ topic: '  audience growth  ' });

        expect(result.success).toBe(true);
        expect(result.data.topic).toBe('audience growth');
    });
});
