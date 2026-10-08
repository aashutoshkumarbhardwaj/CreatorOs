const mongoose = require("mongoose");
const Creator = require("../model/creator");
// The Creator export is a thin wrapper without bulk helpers; clean up via the real Mongoose model.
const CreatorCollection = () => mongoose.models.Creator;
const DmTrigger = require("../model/dmTrigger");
const DmDelivery = require("../model/dmDelivery");
const { processDmJob } = require("../services/dmQueueService");
const { reserveDmDelivery } = require("../services/dmDeliveryService");

describe("DM delivery recovery and exactly-once sending", () => {
  const originalFetch = global.fetch;
  const originalAppId = process.env.INSTAGRAM_APP_ID;
  let creator;

  const job = (eventId, extra = {}) => ({
    id: `job-${eventId}`,
    data: {
      senderId: "ig-sender-1",
      recipientId: "ig-page-1",
      message: "Send me the PRESET link",
      eventId,
      ...extra,
    },
  });

  const okFetch = () =>
    jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid.123" }) });

  beforeAll(async () => {
    await DmDelivery.init();
  });

  beforeEach(async () => {
    process.env.INSTAGRAM_APP_ID = "test_app_id";
    await Promise.all([CreatorCollection().deleteMany({}), DmTrigger.deleteMany({}), DmDelivery.deleteMany({})]);

    const userId = new mongoose.Types.ObjectId();
    creator = await Creator.create({
      userId,
      username: "dm_creator",
      platform: "instagram",
      platformId: "ig-page-1",
      accessToken: "creator-token",
    });
    await DmTrigger.create({
      creatorId: userId,
      keyword: "preset",
      responseUrl: "https://example.com/presets",
      isActive: true,
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalAppId === undefined) delete process.env.INSTAGRAM_APP_ID;
    else process.env.INSTAGRAM_APP_ID = originalAppId;
    await Promise.all([CreatorCollection().deleteMany({}), DmTrigger.deleteMany({}), DmDelivery.deleteMany({})]);
  });

  afterAll(async () => {
    await Promise.all([CreatorCollection().deleteMany({}), DmTrigger.deleteMany({}), DmDelivery.deleteMany({})]);
  });

  it("sends the DM when a previous worker crashed and left an expired reservation", async () => {
    await DmDelivery.create({
      creatorId: creator._id,
      eventId: "evt-crashed",
      status: "reserved",
      leaseExpiresAt: new Date(Date.now() - 1000),
    });
    global.fetch = okFetch();

    const result = await processDmJob(job("evt-crashed"));

    expect(result).toEqual({ success: true, messageId: "mid.123" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const delivery = await DmDelivery.findOne({ creatorId: creator._id, eventId: "evt-crashed" });
    expect(delivery.status).toBe("sent");
    expect(delivery.messageId).toBe("mid.123");
    expect(delivery.attempts).toBe(2);
  });

  it("recovers a legacy reservation that was written before leases existed", async () => {
    await DmDelivery.collection.insertOne({
      creatorId: creator._id,
      eventId: "evt-legacy",
      status: "reserved",
      messageId: null,
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    global.fetch = okFetch();

    const result = await processDmJob(job("evt-legacy"));

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not take over a reservation whose lease is still alive (fails the job so it is retried)", async () => {
    await reserveDmDelivery(creator._id, "evt-live");
    global.fetch = okFetch();

    await expect(processDmJob(job("evt-live"))).rejects.toMatchObject({
      code: "DM_DELIVERY_IN_PROGRESS",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("skips an event that was already sent", async () => {
    await DmDelivery.create({
      creatorId: creator._id,
      eventId: "evt-sent",
      status: "sent",
      messageId: "mid.old",
    });
    global.fetch = okFetch();

    expect(await processDmJob(job("evt-sent"))).toEqual({ skipped: true, reason: "already_sent" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("never sends the same DM twice when saving the 'sent' state fails after a successful send", async () => {
    global.fetch = okFetch();
    jest.spyOn(DmDelivery, "updateOne").mockRejectedValue(new Error("mongo write failed"));

    // First delivery: the DM goes out, recording it fails. The job must still succeed.
    const first = await processDmJob(job("evt-record-fails"));
    expect(first).toMatchObject({ success: true, messageId: "mid.123", deliveryRecorded: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // The reservation must NOT have been released (that is what allowed a second send).
    expect(await DmDelivery.countDocuments({ creatorId: creator._id, eventId: "evt-record-fails" })).toBe(1);

    // A retry of the same event (e.g. stalled-job recovery) must not send again.
    await expect(processDmJob(job("evt-record-fails"))).rejects.toMatchObject({
      code: "DM_DELIVERY_IN_PROGRESS",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("releases the reservation when the send fails so the retry can deliver", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("graph api down"))
      .mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid.456" }) });

    await expect(processDmJob(job("evt-retry"))).rejects.toThrow("graph api down");
    expect(await DmDelivery.countDocuments({ creatorId: creator._id, eventId: "evt-retry" })).toBe(0);

    const retry = await processDmJob(job("evt-retry"));
    expect(retry.messageId).toBe("mid.456");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces the real send error even if releasing the reservation also fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("graph api down"));
    jest.spyOn(DmDelivery, "deleteOne").mockRejectedValue(new Error("mongo unavailable"));

    await expect(processDmJob(job("evt-release-fails"))).rejects.toThrow("graph api down");
  });

  it("lets exactly one worker take over an expired reservation when attempts race", async () => {
    await DmDelivery.create({
      creatorId: creator._id,
      eventId: "evt-race",
      status: "reserved",
      leaseExpiresAt: new Date(Date.now() - 1000),
    });
    global.fetch = okFetch();

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => processDmJob(job("evt-race")))
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === "fulfilled" && r.value.success)).toHaveLength(1);
    results
      .filter((r) => !(r.status === "fulfilled" && r.value.success))
      .forEach((r) => {
        if (r.status === "rejected") expect(r.reason.code).toBe("DM_DELIVERY_IN_PROGRESS");
        else expect(r.value).toEqual({ skipped: true, reason: "already_sent" });
      });
  });
});

describe("reserveDmDelivery lease semantics", () => {
  beforeEach(async () => {
    await DmDelivery.deleteMany({});
  });
  afterAll(async () => {
    await DmDelivery.deleteMany({});
  });

  it("takes over only after the lease has expired and counts the attempt", async () => {
    const creatorId = new mongoose.Types.ObjectId();
    const t0 = new Date("2026-10-01T10:00:00.000Z");

    const first = await reserveDmDelivery(creatorId, "evt-lease", { now: t0, leaseMs: 30000 });
    expect(first).toMatchObject({ claimed: true, reclaimed: false });

    const during = await reserveDmDelivery(creatorId, "evt-lease", {
      now: new Date(t0.getTime() + 29000),
      leaseMs: 30000,
    });
    expect(during.claimed).toBe(false);

    const after = await reserveDmDelivery(creatorId, "evt-lease", {
      now: new Date(t0.getTime() + 31000),
      leaseMs: 30000,
    });
    expect(after).toMatchObject({ claimed: true, reclaimed: true });
    expect(after.delivery.attempts).toBe(2);
  });

  it("never takes over a delivery that is already sent", async () => {
    const creatorId = new mongoose.Types.ObjectId();
    await DmDelivery.create({
      creatorId,
      eventId: "evt-done",
      status: "sent",
      leaseExpiresAt: new Date(Date.now() - 60000),
    });
    const result = await reserveDmDelivery(creatorId, "evt-done");
    expect(result.claimed).toBe(false);
    expect(result.delivery.status).toBe("sent");
  });
});
