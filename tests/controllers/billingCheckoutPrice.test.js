const mockCreateSession = jest.fn();

jest.mock('stripe', () => jest.fn(() => ({
    checkout: {
        sessions: {
            create: mockCreateSession,
        },
    },
})), { virtual: true });

jest.mock('../../model/user', () => ({}));

describe('createCheckoutSession price validation', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env.STRIPE_SECRET_KEY = 'sk_test_123';
        process.env.STRIPE_PRO_PRICE_ID = 'price_allowed';
        process.env.BASE_URL = 'https://app.test';
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    test('rejects client supplied price ids that are not configured', async () => {
        const { createCheckoutSession } = require('../../controller/billing');
        const req = {
            body: { priceId: 'price_unapproved' },
            user: { id: 'user-1', email: 'creator@example.com' },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        await createCheckoutSession(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'Invalid billing plan selected',
        });
        expect(mockCreateSession).not.toHaveBeenCalled();
    });

    test('uses the configured price id when no client price is supplied', async () => {
        mockCreateSession.mockResolvedValue({ url: 'https://checkout.test/session' });
        const { createCheckoutSession } = require('../../controller/billing');
        const req = {
            body: {},
            user: { id: 'user-1', email: 'creator@example.com' },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        await createCheckoutSession(req, res, jest.fn());

        expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
            line_items: [
                {
                    price: 'price_allowed',
                    quantity: 1,
                },
            ],
        }));
        expect(res.json).toHaveBeenCalledWith({ success: true, url: 'https://checkout.test/session' });
    });
});
