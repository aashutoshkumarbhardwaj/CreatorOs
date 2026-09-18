function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    sendStatus: jest.fn(),
  };
}

function messagingPayload({
  text = "hello",
  mid = "mid-1",
  senderId = "sender-1",
  recipientId = "page-1",
  timestamp = 1700000000,
} = {}) {
  return {
    object: "instagram",
    entry: [
      {
        id: recipientId,
        messaging: [
          {
            sender: { id: senderId },
            timestamp,
            message: { text, mid },
          },
        ],
      },
    ],
  };
}

describe("Instagram Webhook Consent Interception", () => {
  const originalEnv = { ...process.env };
  const mockUserId = "507f191e810c19729de860ea";

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  function loadController({
    dmQueueMock = { add: jest.fn().mockResolvedValue({ id: "job-1" }) },
    dmConsentMock = {
      isOptOutKeyword: jest.fn(),
      isOptInKeyword: jest.fn(),
      recordOptOut: jest.fn().mockResolvedValue({}),
      recordOptIn: jest.fn().mockResolvedValue({}),
    },
    creatorFindOneMock = jest.fn().mockResolvedValue({ userId: mockUserId }),
  } = {}) {
    jest.resetModules();
    jest.doMock("../../services/dmQueueService", () => ({
      dmQueue: dmQueueMock,
    }));
    jest.doMock("../../services/dmConsentService", () => dmConsentMock);
    jest.doMock("../../model/creator", () => ({
      findOne: creatorFindOneMock,
    }));
    return require("../../controller/instagramWebhookController");
  }

  it("detects STOP, records opt-out, marks processed, and suppresses enqueue", async () => {
    const dmQueueMock = { add: jest.fn() };
    const dmConsentMock = {
      isOptOutKeyword: jest.fn().mockReturnValue(true),
      isOptInKeyword: jest.fn().mockReturnValue(false),
      recordOptOut: jest.fn().mockResolvedValue({ status: "opted_out" }),
      recordOptIn: jest.fn(),
    };
    const creatorFindOneMock = jest.fn().mockResolvedValue({ userId: mockUserId });

    const { handleWebhook, hasProcessed, clearProcessedEvents } =
      loadController({ dmQueueMock, dmConsentMock, creatorFindOneMock });
    clearProcessedEvents();

    const res = createResponse();
    await handleWebhook(
      {
        body: messagingPayload({ text: "STOP", senderId: "user-1", recipientId: "page-1" }),
        headers: { "x-event-id": "evt-stop-1" },
      },
      res,
      jest.fn()
    );

    expect(dmConsentMock.isOptOutKeyword).toHaveBeenCalledWith("STOP");
    expect(creatorFindOneMock).toHaveBeenCalledWith({
      platform: "instagram",
      platformId: "page-1",
    });
    expect(dmConsentMock.recordOptOut).toHaveBeenCalledWith({
      creatorId: mockUserId,
      platform: "instagram",
      recipientId: "user-1",
      keyword: "STOP",
    });
    expect(dmQueueMock.add).not.toHaveBeenCalled();
    expect(hasProcessed("evt-stop-1")).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("EVENT_RECEIVED");
  });

  it("handles opt-out gracefully when creator is not found", async () => {
    const dmQueueMock = { add: jest.fn() };
    const dmConsentMock = {
      isOptOutKeyword: jest.fn().mockReturnValue(true),
      isOptInKeyword: jest.fn().mockReturnValue(false),
      recordOptOut: jest.fn(),
      recordOptIn: jest.fn(),
    };
    const creatorFindOneMock = jest.fn().mockResolvedValue(null);

    const { handleWebhook, hasProcessed, clearProcessedEvents } =
      loadController({ dmQueueMock, dmConsentMock, creatorFindOneMock });
    clearProcessedEvents();

    const res = createResponse();
    await handleWebhook(
      {
        body: messagingPayload({ text: "UNSUBSCRIBE", senderId: "user-2", recipientId: "unknown-page" }),
        headers: { "x-event-id": "evt-unsub-1" },
      },
      res,
      jest.fn()
    );

    expect(dmConsentMock.recordOptOut).not.toHaveBeenCalled();
    expect(dmQueueMock.add).not.toHaveBeenCalled();
    expect(hasProcessed("evt-unsub-1")).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("EVENT_RECEIVED");
  });

  it("enqueues normal messages without triggering opt-out", async () => {
    const dmQueueMock = { add: jest.fn().mockResolvedValue({ id: "job-norm" }) };
    const dmConsentMock = {
      isOptOutKeyword: jest.fn().mockReturnValue(false),
      isOptInKeyword: jest.fn().mockReturnValue(false),
      recordOptOut: jest.fn(),
      recordOptIn: jest.fn(),
    };

    const { handleWebhook, hasProcessed, clearProcessedEvents } =
      loadController({ dmQueueMock, dmConsentMock });
    clearProcessedEvents();

    const res = createResponse();
    await handleWebhook(
      {
        body: messagingPayload({ text: "GUIDE", senderId: "user-3", recipientId: "page-1" }),
        headers: { "x-event-id": "evt-normal-1" },
      },
      res,
      jest.fn()
    );

    expect(dmConsentMock.recordOptOut).not.toHaveBeenCalled();
    expect(dmQueueMock.add).toHaveBeenCalledTimes(1);
    expect(hasProcessed("evt-normal-1")).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("EVENT_RECEIVED");
  });

  it("records opt-in on START and continues normal message processing", async () => {
    const dmQueueMock = { add: jest.fn().mockResolvedValue({ id: "job-optin" }) };
    const dmConsentMock = {
      isOptOutKeyword: jest.fn().mockReturnValue(false),
      isOptInKeyword: jest.fn().mockReturnValue(true),
      recordOptOut: jest.fn(),
      recordOptIn: jest.fn().mockResolvedValue({ status: "opted_in" }),
    };
    const creatorFindOneMock = jest.fn().mockResolvedValue({ userId: mockUserId });

    const { handleWebhook, hasProcessed, clearProcessedEvents } =
      loadController({ dmQueueMock, dmConsentMock, creatorFindOneMock });
    clearProcessedEvents();

    const res = createResponse();
    await handleWebhook(
      {
        body: messagingPayload({ text: "START", senderId: "user-4", recipientId: "page-1" }),
        headers: { "x-event-id": "evt-start-1" },
      },
      res,
      jest.fn()
    );

    expect(dmConsentMock.recordOptIn).toHaveBeenCalledWith({
      creatorId: mockUserId,
      platform: "instagram",
      recipientId: "user-4",
      keyword: "START",
    });
    expect(dmQueueMock.add).toHaveBeenCalledTimes(1);
    expect(hasProcessed("evt-start-1")).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("skips duplicate STOP event without re-processing or re-recording", async () => {
    const dmConsentMock = {
      isOptOutKeyword: jest.fn().mockReturnValue(true),
      isOptInKeyword: jest.fn().mockReturnValue(false),
      recordOptOut: jest.fn(),
      recordOptIn: jest.fn(),
    };

    const { handleWebhook, markProcessed, clearProcessedEvents } =
      loadController({ dmConsentMock });
    clearProcessedEvents();
    markProcessed("evt-dup-stop");

    const res = createResponse();
    await handleWebhook(
      {
        body: messagingPayload({ text: "STOP", senderId: "user-1", recipientId: "page-1" }),
        headers: { "x-event-id": "evt-dup-stop" },
      },
      res,
      jest.fn()
    );

    expect(dmConsentMock.recordOptOut).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("EVENT_RECEIVED");
  });
});
