describe('MockUrlModel user ownership', () => {
    const originalUseMockDb = process.env.USE_MOCK_DB;
    let Url;

    beforeEach(() => {
        jest.resetModules();
        process.env.USE_MOCK_DB = 'true';
        Url = require('../../model/url');
    });

    afterEach(async () => {
        await Url.deleteMany({});
        if (originalUseMockDb === undefined) {
            delete process.env.USE_MOCK_DB;
        } else {
            process.env.USE_MOCK_DB = originalUseMockDb;
        }
    });

    test('preserves userId for mock-created links', async () => {
        const link = await Url.create({
            shortId: 'abc123',
            redirectUrl: 'https://example.com',
            userId: 'user-1',
        });

        expect(link.userId).toBe('user-1');
    });

    test('lists only links for the requested mock user', async () => {
        await Url.create({
            shortId: 'user-link',
            redirectUrl: 'https://example.com/user',
            userId: 'user-1',
        });
        await Url.create({
            shortId: 'other-link',
            redirectUrl: 'https://example.com/other',
            userId: 'user-2',
        });

        const links = await Url.listForUser('user-1');

        expect(links).toHaveLength(1);
        expect(links[0].shortId).toBe('user-link');
    });
});
