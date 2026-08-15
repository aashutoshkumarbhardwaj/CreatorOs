function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    sendStatus: jest.fn(),
  };
}

function messagingPayload({ text = "hello", mid = "mid-1", senderId = "sender-1", timestamp = 1700000000 } = {}) {
  return {
    object: "instagram",
    entry: [
      {
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

describe("instagram webhook dedup enqueue (#984)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  function loadController(dmQueueMock) {
    jest.resetModules();
    jest.doMock("../../services/dmQueueService", () => ({
      dmQueue: dmQueueMock,
    }));
    return require("../../controller/instagramWebhookController");
  }

  it("marks processed only after successful enqueue and returns 200", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job-1" });
    const { handleWebhook, hasProcessed, clearProcessedEvents } = loadController({ add });
    clearProcessedEvents();

    const res = createResponse();
    await handleWebhook(
      { body: messagingPayload(), headers: { "x-event-id": "evt-success" } },
      res,
      jest.fn()
    );

    expect(add).toHaveBeenCalledTimes(1);
    expect(hasProcessed("evt-success")).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("EVENT_RECEIVED");
  });

  it("does not mark processed and returns 503 when enqueue fails", async () => {
    const add = jest.fn().mockRejectedValue(new Error("redis down"));
    const { handleWebhook, hasProcessed, clearProcessedEvents } = loadController({ add });
    clearProcessedEvents();

    const res = createResponse();
    await handleWebhook(
      { body: messagingPayload(), headers: { "x-event-id": "evt-fail" } },
      res,
      jest.fn()
    );

    expect(add).toHaveBeenCalledTimes(1);
    expect(hasProcessed("evt-fail")).toBe(false);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith("SERVICE_UNAVAILABLE");
  });

  it("returns 503 when dmQueue is undefined", async () => {
    const { handleWebhook, hasProcessed, clearProcessedEvents } = loadController(undefined);
    clearProcessedEvents();

    const res = createResponse();
    await handleWebhook(
      { body: messagingPayload(), headers: { "x-event-id": "evt-missing-queue" } },
      res,
      jest.fn()
    );

    expect(hasProcessed("evt-missing-queue")).toBe(false);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith("SERVICE_UNAVAILABLE");
  });

  it("skips already processed events on retry after a prior success", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job-1" });
    const { handleWebhook, markProcessed, clearProcessedEvents } = loadController({ add });
    clearProcessedEvents();
    markProcessed("evt-dup");

    const res = createResponse();
    await handleWebhook(
      { body: messagingPayload(), headers: { "x-event-id": "evt-dup" } },
      res,
      jest.fn()
    );

    expect(add).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("EVENT_RECEIVED");
  });
});
