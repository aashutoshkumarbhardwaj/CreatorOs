process.env.USE_MOCK_DB = "true";
const Url = require('../../model/url');

describe('Url Model', () => {
    it('should create a new URL in mock DB', async () => {
        const url = await Url.create({ shortId: 'xyz123', redirectUrl: 'https://example.com' });
        expect(url.shortId).toBe('xyz123');
        expect(url.redirectUrl).toBe('https://example.com');
    });

    it('should find URL by shortId', async () => {
        await Url.create({ shortId: 'abcd56', redirectUrl: 'https://test.com' });
        const url = await Url.findOne({ shortId: 'abcd56' });
        expect(url).toBeDefined();
        expect(url.redirectUrl).toBe('https://test.com');
    });
});
