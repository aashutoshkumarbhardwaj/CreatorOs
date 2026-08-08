const { fetchInstagramAnalytics } = require('../utils/instagramApi');

describe('Instagram Analytics API', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('sums real media like and comment counts across paginated media', async () => {
        const creator = {
            _id: 'creator123',
            platform: 'instagram',
            platformId: 'user123',
            accessToken: 'valid_token',
        };

        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    followers_count: 1000,
                    follows_count: 200,
                    media_count: 3,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        { like_count: 50, comments_count: 10 },
                        { like_count: 30, comments_count: 10 },
                    ],
                    paging: {
                        next: 'https://graph.instagram.com/user123/media?after=cursor1&access_token=valid_token',
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        { like_count: 20, comments_count: 5 },
                    ],
                }),
            });

        const result = await fetchInstagramAnalytics(creator);

        expect(result.followers).toBe(1000);
        expect(result.following).toBe(200);
        expect(result.totalPosts).toBe(3);
        expect(result.totalLikes).toBe(100);
        expect(result.totalComments).toBe(25);
        expect(result.engagementRate).toBe(12.5); // (100+25)/1000 * 100
        expect(result.engagementAvailable).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('returns zero engagement and engagementAvailable: false when media insights are unavailable', async () => {
        const creator = {
            _id: 'creator456',
            platform: 'instagram',
            platformId: 'user456',
            accessToken: 'basic_token',
        };

        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    followers_count: 500,
                    follows_count: 100,
                    media_count: 10,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [],
                }),
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

    it('falls back to profile-only metrics when media insights request is rejected', async () => {
        const creator = {
            _id: 'creator789',
            platform: 'instagram',
            platformId: 'user789',
            accessToken: 'limited_token',
        };

        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    followers_count: 750,
                    follows_count: 90,
                    media_count: 12,
                }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                text: async () => JSON.stringify({ error: { message: 'Permission denied' } }),
            });

        const result = await fetchInstagramAnalytics(creator);

        expect(result.followers).toBe(750);
        expect(result.following).toBe(90);
        expect(result.totalPosts).toBe(12);
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
