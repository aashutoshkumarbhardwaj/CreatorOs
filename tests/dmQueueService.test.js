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

    it('requires an explicit creator access token', async () => {
        process.env.INSTAGRAM_ACCESS_TOKEN = 'global_token';
        process.env.INSTAGRAM_APP_ID = 'test_app';

        await expect(sendInstagramDM('12345', 'Hello!'))
            .rejects.toMatchObject({ code: 'DM_CREDENTIAL_MISSING' });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uses the supplied creator access token for the outbound request', async () => {
        process.env.INSTAGRAM_ACCESS_TOKEN = 'global_token';
        process.env.INSTAGRAM_APP_ID = 'test_app';

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ recipient_id: '12345', message_id: 'mid.100' })
        });

        const result = await sendInstagramDM('12345', 'Hello Instagram!', {
            accessToken: 'creator_token_a',
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://graph.facebook.com/v21.0/me/messages');
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe('Bearer creator_token_a');
        expect(options.headers.Authorization).not.toContain('global_token');
        expect(JSON.parse(options.body)).toEqual({
            recipient: { id: '12345' },
            messaging_type: 'RESPONSE',
            message: { text: 'Hello Instagram!' }
        });
        expect(result.messageId).toBe('mid.100');
    });

    it('throws error with status code and API message when Graph API returns failure', async () => {
        process.env.INSTAGRAM_APP_ID = 'test_app';
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ error: { message: 'Invalid OAuth access token.' } })
        });

        try {
            await sendInstagramDM('12345', 'Hello!', { accessToken: 'invalid_token' });
            fail('Expected sendInstagramDM to throw error');
        } catch (error) {
            expect(error.message).toContain('Instagram DM send failed: 400');
            expect(error.status).toBe(400);
        }
    });
});
