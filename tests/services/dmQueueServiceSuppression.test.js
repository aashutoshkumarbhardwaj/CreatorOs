describe("DM Queue Worker Consent Suppression", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  let workerProcessor = null;
  let mockCreatorFindOne;
  let mockDmTriggerFind;
  let mockDmConsentCanSend;

  beforeEach(() => {
    jest.resetModules();
    process.env.REDIS_URI = "redis://127.0.0.1:6379";
    process.env.INSTAGRAM_ACCESS_TOKEN = "test_creator_token";
    process.env.INSTAGRAM_APP_ID = "test_app_id";
    delete process.env.VERCEL;

    mockCreatorFindOne = jest.fn();
    mockDmTriggerFind = jest.fn();
    mockDmConsentCanSend = jest.fn();

    jest.doMock("bullmq", () => ({
      Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn(),
      })),
      Worker: jest.fn().mockImplementation((queueName, processor) => {
        workerProcessor = processor;
        return {
          on: jest.fn(),
        };
      }),
    }));

    jest.doMock("ioredis", () => {
      return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
      }));
    });

    jest.doMock("../../model/creator", () => ({
      findOne: mockCreatorFindOne,
    }));

    jest.doMock("../../model/dmTrigger", () => ({
      find: mockDmTriggerFind,
    }));

    jest.doMock("../../services/dmConsentService", () => ({
      canSend: mockDmConsentCanSend,
    }));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: "mid.success.123" }),
    });

    // Load dmQueueService to trigger Worker initialization
    require("../../services/dmQueueService");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("suppresses message dispatch and does not call Meta API when recipient is opted out", async () => {
    expect(typeof workerProcessor).toBe("function");

    const creatorId = "creator_user_123";
    const recipientPlatformId = "page_instagram_456";
    const senderId = "audience_user_789";

    mockCreatorFindOne.mockResolvedValue({
      userId: creatorId,
      accessToken: "token_abc",
      platform: "instagram",
      platformId: recipientPlatformId,
    });

    mockDmTriggerFind.mockResolvedValue([
      {
        creatorId,
        keyword: "guide",
        responseUrl: "https://creatoros.com/guide.pdf",
        isActive: true,
      },
    ]);

    // Recipient is opted out
    mockDmConsentCanSend.mockResolvedValue(false);

    const job = {
      id: "job-opted-out",
      data: {
        senderId,
        recipientId: recipientPlatformId,
        message: "Send me the GUIDE",
      },
    };

    const result = await workerProcessor(job);

    expect(mockDmConsentCanSend).toHaveBeenCalledWith({
      creatorId,
      platform: "instagram",
      recipientId: senderId,
    });

    expect(result).toEqual({
      skipped: true,
      suppressed: true,
      reason: "recipient_opted_out",
    });

    // External Meta API was NEVER called
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dispatches message via Meta API when recipient is compliant (opted in)", async () => {
    expect(typeof workerProcessor).toBe("function");

    const creatorId = "creator_user_123";
    const recipientPlatformId = "page_instagram_456";
    const senderId = "audience_user_789";

    mockCreatorFindOne.mockResolvedValue({
      userId: creatorId,
      accessToken: "token_abc",
      platform: "instagram",
      platformId: recipientPlatformId,
    });

    mockDmTriggerFind.mockResolvedValue([
      {
        creatorId,
        keyword: "guide",
        responseUrl: "https://creatoros.com/guide.pdf",
        isActive: true,
      },
    ]);

    // Recipient is compliant
    mockDmConsentCanSend.mockResolvedValue(true);

    const job = {
      id: "job-compliant",
      data: {
        senderId,
        recipientId: recipientPlatformId,
        message: "Send me the GUIDE",
      },
    };

    const result = await workerProcessor(job);

    expect(mockDmConsentCanSend).toHaveBeenCalledWith({
      creatorId,
      platform: "instagram",
      recipientId: senderId,
    });

    expect(result).toEqual({
      success: true,
      messageId: "mid.success.123",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/me/messages");
    expect(JSON.parse(options.body)).toEqual({
      recipient: { id: senderId },
      messaging_type: "RESPONSE",
      message: { text: "https://creatoros.com/guide.pdf" },
    });
  });

  it("propagates canSend database failure so the worker/job fails for retry", async () => {
    expect(typeof workerProcessor).toBe("function");

    const creatorId = "creator_user_123";
    const recipientPlatformId = "page_instagram_456";
    const senderId = "audience_user_789";

    mockCreatorFindOne.mockResolvedValue({
      userId: creatorId,
      accessToken: "token_abc",
      platform: "instagram",
      platformId: recipientPlatformId,
    });

    mockDmTriggerFind.mockResolvedValue([
      {
        creatorId,
        keyword: "guide",
        responseUrl: "https://creatoros.com/guide.pdf",
        isActive: true,
      },
    ]);

    // DB failure during consent check
    const dbError = new Error("MongoDB connection lost");
    mockDmConsentCanSend.mockRejectedValue(dbError);

    const job = {
      id: "job-db-error",
      data: {
        senderId,
        recipientId: recipientPlatformId,
        message: "Send me the GUIDE",
      },
    };

    await expect(workerProcessor(job)).rejects.toThrow("MongoDB connection lost");

    // Must NOT send message on DB failure
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
