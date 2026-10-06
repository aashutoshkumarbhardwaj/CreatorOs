const { sendInstagramDM } = require("../services/dmQueueService");

describe("DM Queue Service request timeout", () => {
    const originalFetch = global.fetch;
    const originalAppId = process.env.INSTAGRAM_APP_ID;

    afterEach(() => {
        global.fetch = originalFetch;
        if (originalAppId === undefined) {
            delete process.env.INSTAGRAM_APP_ID;
        } else {
            process.env.INSTAGRAM_APP_ID = originalAppId;
        }
    });

    it("aborts a stalled Instagram Graph API request", async () => {
        process.env.INSTAGRAM_APP_ID = "test_app";

        global.fetch = jest.fn((_url, options) =>
            new Promise((resolve, reject) => {
                options.signal.addEventListener(
                    "abort",
                    () => reject(options.signal.reason),
                    { once: true },
                );
            }),
        );

        await expect(
            sendInstagramDM("12345", "Hello!", {
                accessToken: "creator_token",
                timeoutMs: 20,
            }),
        ).rejects.toMatchObject({
            code: "DM_REQUEST_TIMEOUT",
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it("preserves non-timeout fetch failures", async () => {
        process.env.INSTAGRAM_APP_ID = "test_app";
        const networkError = new Error("socket closed");
        global.fetch = jest.fn().mockRejectedValue(networkError);

        await expect(
            sendInstagramDM("12345", "Hello!", {
                accessToken: "creator_token",
                timeoutMs: 20,
            }),
        ).rejects.toBe(networkError);
    });
});
