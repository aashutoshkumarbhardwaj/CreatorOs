const { sendInstagramDM } = require('../services/dmQueueService');

describe('DM Queue Service sendInstagramDM', () => {
    const originalFetch = global.fetch;
    const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const originalAppId = process.env.INSTAGRAM_APP_ID;

    afterEach(() => {
        global.fetch = originalFetch;

        if (originalToken === undefined) {
            delete process.env.INSTAGRAM_ACCESS_TOKEN;
        } else {
            process.env.INSTAGRAM_ACCESS_TOKEN = originalToken;
        }

        if (originalAppId === undefined) {
            delete process.env.INSTAGRAM_APP_ID;
        } else {
            process.env.INSTAGRAM_APP_ID = originalAppId;
        }
    });

    it('throws an error when Instagram DM configuration is missing', async () => {
        delete process.env.INSTAGRAM_ACCESS_TOKEN;
        delete process.env.INSTAGRAM_APP_ID;

        await expect(sendInstagramDM('12345', 'Hello!'))
            .rejects.toMatchObject({
                code: 'DM_NOT_CONFIGURED',
            });
    });

    it('makes an outbound POST request to the Instagram Graph API', async () => {
        process.env.INSTAGRAM_ACCESS_TOKEN = 'test_page_token';
        process.env.INSTAGRAM_APP_ID = 'test_app_id';

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ message_id: 'mid.100' }),
        });

        const result = await sendInstagramDM('12345', 'Hello Instagram!');

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];

        expect(url).toBe('https://graph.facebook.com/v21.0/me/messages');
        expect(options.method).toBe('POST');
        expect(options.headers).toEqual({
            Authorization: 'Bearer test_page_token',
            'Content-Type': 'application/json',
            'X-Ig-App-Id': 'test_app_id',
        });
        expect(JSON.parse(options.body)).toEqual({
            recipient: { id: '12345' },
            messaging_type: 'RESPONSE',
            message: { text: 'Hello Instagram!' },
        });
        expect(options.signal).toBeInstanceOf(AbortSignal);
        expect(result).toEqual({ success: true, messageId: 'mid.100' });
    });

    it('throws an error with the HTTP status when Graph API returns failure', async () => {
        process.env.INSTAGRAM_APP_ID = 'test_app_id';

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({
                error: { message: 'Invalid OAuth access token.' },
            }),
        });

        try {
            await sendInstagramDM('12345', 'Hello!', {
                accessToken: 'invalid_token',
            });
            fail('Expected sendInstagramDM to throw error');
        } catch (error) {
            expect(error.message).toContain('Instagram DM send failed: 400');
            expect(error.status).toBe(400);
        }
    });
});
