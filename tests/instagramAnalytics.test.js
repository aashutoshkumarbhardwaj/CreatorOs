const { fetchInstagramAnalytics } = require('../utils/instagramApi');

describe('Instagram Analytics API', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('sums real media like and comment counts when media insights are returned', async () => {
        const creator = {
            _id: 'creator123',
            platform: 'instagram',
            platformId: 'user123',
            accessToken: 'valid_token',
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                followers_count: 1000,
                follows_count: 200,
                media_count: 2,
                media: {
                    data: [
                        { like_count: 50, comments_count: 10 },
                        { like_count: 30, comments_count: 10 },
                    ]
                }
            })
        });

        const result = await fetchInstagramAnalytics(creator);

        expect(result.followers).toBe(1000);
        expect(result.following).toBe(200);
        expect(result.totalPosts).toBe(2);
        expect(result.totalLikes).toBe(80);
        expect(result.totalComments).toBe(20);
        expect(result.engagementRate).toBe(10); // (80+20)/1000 * 100 = 10%
        expect(result.engagementAvailable).toBe(true);
    });

    it('returns zero engagement and engagementAvailable: false when media insights are unavailable', async () => {
        const creator = {
            _id: 'creator456',
            platform: 'instagram',
            platformId: 'user456',
            accessToken: 'basic_token',
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                followers_count: 500,
                follows_count: 100,
                media_count: 10,
            })
        });

        const result = await fetchInstagramAnalytics(creator);

        expect(result.followers).toBe(500);
        expect(result.following).toBe(100);
        expect(result.totalPosts).toBe(10);
        expect(result.totalLikes).toBe(0);
        expect(result.totalComments).toBe(0);
        expect(result.engagementRate).toBe(0);
        expect(result.engagementAvailable).toBe(false);
    });

    it('throws error for invalid platform or missing token', async () => {
        await expect(fetchInstagramAnalytics({ platform: 'youtube' }))
            .rejects.toThrow('Creator does not have a valid Instagram access token');
    });
});
