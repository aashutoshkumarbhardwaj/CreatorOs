const mockFind = jest.fn();

jest.mock('../../model/url', () => ({
    find: mockFind,
}));

const { handleRenderDashboard } = require('../../controller/url');

describe('handleRenderDashboard cursor validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders a controlled 400 response for invalid cursors', async () => {
        const req = {
            query: { cursor: 'not-an-object-id' },
            user: { id: 'user-1' },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            render: jest.fn(),
        };

        await handleRenderDashboard(req, res, jest.fn());

        expect(mockFind).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.render).toHaveBeenCalledWith('home', expect.objectContaining({
            error: 'Invalid pagination cursor',
            urls: [],
            hasMore: false,
        }));
    });
});
