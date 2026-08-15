const { getInstagramProfile } = require('../../controller/instagramController');
const instagramService = require('../../utils/instagramProfileService');

jest.mock('../../utils/instagramProfileService', () => {
    const original = jest.requireActual('../../utils/instagramProfileService');
    return {
        ...original,
        fetchInstagramProfile: jest.fn(),
    };
});

describe('Instagram Controller - Profile Cache & Cooldown', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        jest.clearAllMocks();
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
    });

    it('should serve cached profile on cache hit without triggering rate limiting', async () => {
        const dummyProfile = {
            username: 'cacheduser',
            name: 'Cached User',
            followers: 100,
        };
        instagramService.fetchInstagramProfile.mockResolvedValue(dummyProfile);

        // First lookup (uncached) - triggers fetch & sets cache & cooldown
        mockReq = {
            query: { username: 'cacheduser' },
            user: { id: 'user_123' },
        };

        await getInstagramProfile(mockReq, mockRes);
        expect(instagramService.fetchInstagramProfile).toHaveBeenCalledWith('cacheduser');
        expect(mockRes.json).toHaveBeenCalledWith({
            success: true,
            data: dummyProfile,
        });

        mockRes.json.mockClear();

        // Second lookup for SAME username (should hit cache despite active cooldown)
        await getInstagramProfile(mockReq, mockRes);
        expect(instagramService.fetchInstagramProfile).toHaveBeenCalledTimes(1);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: true,
            data: dummyProfile,
        });
    });

    it('should enforce rate limit cooldown on cache miss when cooldown is active', async () => {
        const dummyProfile1 = { username: 'userone', name: 'User One' };
        instagramService.fetchInstagramProfile.mockResolvedValue(dummyProfile1);

        mockReq = {
            query: { username: 'userone' },
            user: { id: 'user_456' },
        };

        // First call sets cooldown for user_456
        await getInstagramProfile(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: true,
            data: dummyProfile1,
        });

        mockRes.json.mockClear();

        // Second call for a DIFFERENT, uncached profile for user_456
        mockReq = {
            query: { username: 'usertwo' },
            user: { id: 'user_456' },
        };

        await getInstagramProfile(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(429);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            error: expect.objectContaining({
                code: 'RATE_LIMITED',
            }),
        });
    });
});
