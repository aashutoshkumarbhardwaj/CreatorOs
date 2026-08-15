const { sendInstagramDM } = require('../../services/dmQueueService');

describe('sendInstagramDM', () => {
    const ORIGINAL_APP_ID = process.env.INSTAGRAM_APP_ID;
    const ORIGINAL_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
    const originalFetch = global.fetch;

    afterEach(() => {
        if (ORIGINAL_APP_ID === undefined) {
            delete process.env.INSTAGRAM_APP_ID;
        } else {
            process.env.INSTAGRAM_APP_ID = ORIGINAL_APP_ID;
        }
        if (ORIGINAL_ACCESS_TOKEN === undefined) {
            delete process.env.INSTAGRAM_ACCESS_TOKEN;
        } else {
            process.env.INSTAGRAM_ACCESS_TOKEN = ORIGINAL_ACCESS_TOKEN;
        }
        global.fetch = originalFetch;
    });

    it('rejects with a clear error when Instagram credentials are not configured', async () => {
        delete process.env.INSTAGRAM_APP_ID;
        delete process.env.INSTAGRAM_ACCESS_TOKEN;

        await expect(sendInstagramDM('123', 'Hello')).rejects.toThrow(/not configured/);
    });

    it('posts to the Graph API messages endpoint with X-Ig-App-Id header and returns the message id', async () => {
        process.env.INSTAGRAM_APP_ID = 'app-id-1';
        process.env.INSTAGRAM_ACCESS_TOKEN = 'tok-1';

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ message_id: 'mid_123' }),
        });

        const result = await sendInstagramDM('sender-456', 'Hi!');

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://graph.facebook.com/v21.0/me/messages');
        expect(options.method).toBe('POST');
        expect(options.headers['X-Ig-App-Id']).toBe('app-id-1');
        expect(options.headers.Authorization).toBe('Bearer tok-1');
        const body = JSON.parse(options.body);
        expect(body.recipient.id).toBe('sender-456');
        expect(body.message.text).toBe('Hi!');
        expect(result).toEqual({ success: true, messageId: 'mid_123' });
    });

    it('throws with the HTTP status and Graph API error code on failure', async () => {
        process.env.INSTAGRAM_APP_ID = 'app-id-1';
        process.env.INSTAGRAM_ACCESS_TOKEN = 'tok-1';

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: async () => JSON.stringify({ error: { code: 4, message: 'Rate limited' } }),
        });

        await expect(sendInstagramDM('sender-456', 'Hi!')).rejects.toMatchObject({
            status: 429,
            code: 4,
        });
    });
});
