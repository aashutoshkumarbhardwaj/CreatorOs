const { sendInstagramDM } = require('../services/dmQueueService');

describe('DM Queue Service sendInstagramDM', () => {
    const originalFetch = global.fetch;
    const originalToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.INSTAGRAM_PAGE_ACCESS_TOKEN = originalToken;
    });

    it('throws error when access token is not configured', async () => {
        delete process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
        delete process.env.INSTAGRAM_ACCESS_TOKEN;

        await expect(sendInstagramDM('12345', 'Hello!'))
            .rejects.toThrow('Instagram Page Access Token is not configured');
    });

    it('makes outbound POST request to Instagram Graph API when token is provided', async () => {
        process.env.INSTAGRAM_PAGE_ACCESS_TOKEN = 'test_page_token';

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ recipient_id: '12345', message_id: 'mid.100' })
        });

        const result = await sendInstagramDM('12345', 'Hello Instagram!');

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('https://graph.instagram.com/v19.0/me/messages');
        expect(url).toContain('access_token=test_page_token');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({
            recipient: { id: '12345' },
            message: { text: 'Hello Instagram!' }
        });
        expect(result.message_id).toBe('mid.100');
    });

    it('throws error with status code and API message when Graph API returns failure', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ error: { message: 'Invalid OAuth access token.' } })
        });

        try {
            await sendInstagramDM('12345', 'Hello!', { accessToken: 'invalid_token' });
            fail('Expected sendInstagramDM to throw error');
        } catch (error) {
            expect(error.message).toContain('Instagram DM Delivery Error (400)');
            expect(error.code).toBe(400);
            expect(error.apiError.message).toBe('Invalid OAuth access token.');
        }
    });
});
