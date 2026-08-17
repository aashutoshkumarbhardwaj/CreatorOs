const { suggestionSchema } = require('../../middleware/validators');

describe('suggestionSchema', () => {
    test('rejects whitespace-only topics', () => {
        const result = suggestionSchema.safeParse({ topic: '   ' });

        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe('Topic is required');
    });

    test('applies default options when only topic is provided', () => {
        const result = suggestionSchema.safeParse({ topic: 'tech news' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            topic: 'tech news',
            platform: 'instagram',
            tone: 'energetic',
            length: 'medium',
            language: 'english',
            includeEmojis: true,
            includeCta: true
        });
    });

    test('accepts valid platform, tone, length, language options', () => {
        const result = suggestionSchema.safeParse({
            topic: 'AI tools for creators',
            platform: 'linkedin',
            tone: 'professional',
            length: 'long',
            language: 'spanish',
            includeEmojis: false,
            includeCta: true
        });

        expect(result.success).toBe(true);
        expect(result.data.platform).toBe('linkedin');
        expect(result.data.tone).toBe('professional');
        expect(result.data.length).toBe('long');
        expect(result.data.language).toBe('spanish');
        expect(result.data.includeEmojis).toBe(false);
    });

    test('rejects invalid platform or length', () => {
        const result = suggestionSchema.safeParse({
            topic: 'growth tips',
            platform: 'invalid_platform',
            length: 'ultra_long'
        });

        expect(result.success).toBe(false);
    });
});
