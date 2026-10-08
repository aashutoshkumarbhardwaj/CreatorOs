const mongoose = require("mongoose");
const Creator = require("../model/creator");
const DmTrigger = require("../model/dmTrigger");
const DmDelivery = require("../model/dmDelivery");
const { processDmJob, DM_DELIVERY_IN_PROGRESS } = require("../services/dmQueueService");

const creatorId = new mongoose.Types.ObjectId();

function makeJob(eventId = "evt-1") {
  return {
    id: eventId,
    data: { senderId: "sender-9", recipientId: "ig-1", message: "What is the PRICE?", eventId },
  };
}

async function failureOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the promise to reject");
}

function graphOk(messageId = "mid.100") {
  return { ok: true, json: async () => ({ message_id: messageId }) };
}

async function deliveryFor(eventId) {
  return DmDelivery.findOne({ creatorId, eventId });
}

async function expireLease(eventId) {
  await DmDelivery.updateOne({ creatorId, eventId }, { $set: { leaseExpiresAt: new Date(Date.now() - 1000) } });
}

describe("processDmJob delivery guarantees", () => {
  const originalFetch = global.fetch;
  const originalAppId = process.env.INSTAGRAM_APP_ID;
  const fast = { markRetryDelayMs: 1 };
  let silence;

  beforeEach(async () => {
    process.env.INSTAGRAM_APP_ID = "test_app";
    await DmDelivery.deleteMany({});
    jest.spyOn(Creator, "findOne").mockResolvedValue({ _id: creatorId, userId: "user-1", accessToken: "creator_token" });
    jest.spyOn(DmTrigger, "find").mockResolvedValue([{ keyword: "price", responseUrl: "Price list: https://example.test" }]);
    global.fetch = jest.fn().mockResolvedValue(graphOk());
    silence = [jest.spyOn(console, "log").mockImplementation(() => {}), jest.spyOn(console, "warn").mockImplementation(() => {}), jest.spyOn(console, "error").mockImplementation(() => {})];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalAppId === undefined) delete process.env.INSTAGRAM_APP_ID;
    else process.env.INSTAGRAM_APP_ID = originalAppId;
  });

  it("sends the reply once and records the delivery as sent", async () => {
    const result = await processDmJob(makeJob("evt-ok"), fast);

    expect(result).toEqual({ success: true, messageId: "mid.100" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const delivery = await deliveryFor("evt-ok");
    expect(delivery.status).toBe("sent");
    expect(delivery.messageId).toBe("mid.100");
    expect(delivery.leaseExpiresAt).toBeNull();
  });

  it("does not send a second DM when recording 'sent' fails transiently after a successful send", async () => {
    jest.spyOn(DmDelivery, "updateOne").mockRejectedValueOnce(new Error("mongo blip"));

    const result = await processDmJob(makeJob("evt-blip"), fast);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((await deliveryFor("evt-blip")).status).toBe("sent");

    // BullMQ redelivers the job: it must be recognised as already sent.
    expect(await processDmJob(makeJob("evt-blip"), fast)).toEqual({ skipped: true, reason: "already_sent" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("completes the job (no retry, no duplicate) even if 'sent' can never be recorded", async () => {
    jest.spyOn(DmDelivery, "updateOne").mockRejectedValue(new Error("mongo down"));

    const result = await processDmJob(makeJob("evt-down"), fast);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // The reservation is NOT released: releasing it is what used to enable a duplicate resend.
    expect((await deliveryFor("evt-down")).status).toBe("reserved");
  });

  it("releases the reservation and rethrows the send error so BullMQ can retry", async () => {
    global.fetch.mockRejectedValueOnce(new Error("socket hang up"));

    const error = await failureOf(processDmJob(makeJob("evt-retry"), fast));
    expect(error.message).toBe("socket hang up");
    expect(await deliveryFor("evt-retry")).toBeNull();

    const retry = await processDmJob(makeJob("evt-retry"), fast);
    expect(retry.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces the original send error and recovers after lease expiry when the release also fails", async () => {
    global.fetch.mockRejectedValueOnce(new Error("socket hang up"));
    jest.spyOn(DmDelivery, "deleteOne").mockRejectedValueOnce(new Error("mongo down"));

    const error = await failureOf(processDmJob(makeJob("evt-both"), fast));
    expect(error.message).toBe("socket hang up"); // not masked by the release failure
    expect((await deliveryFor("evt-both")).status).toBe("reserved");

    // Lease still live: the retry must fail (and be retried later), not complete as 'skipped'.
    const early = await failureOf(processDmJob(makeJob("evt-both"), fast));
    expect(early.code).toBe(DM_DELIVERY_IN_PROGRESS);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Lease expired: the delivery is taken over and the reply is finally sent.
    await expireLease("evt-both");
    const recovered = await processDmJob(makeJob("evt-both"), fast);
    expect(recovered.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((await deliveryFor("evt-both")).status).toBe("sent");
  });

  it("recovers a delivery left 'reserved' by a crashed worker instead of dropping the reply", async () => {
    await DmDelivery.create({
      creatorId,
      eventId: "evt-crash",
      status: "reserved",
      claimId: "dead-worker",
      leaseExpiresAt: new Date(Date.now() - 5000),
    });

    const result = await processDmJob(makeJob("evt-crash"), fast);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((await deliveryFor("evt-crash")).status).toBe("sent");
  });

  it("recovers legacy 'reserved' rows that were written before leases existed", async () => {
    await DmDelivery.collection.insertOne({ creatorId, eventId: "evt-legacy", status: "reserved", messageId: null });

    const result = await processDmJob(makeJob("evt-legacy"), fast);

    expect(result.success).toBe(true);
    expect((await deliveryFor("evt-legacy")).status).toBe("sent");
  });

  it("fails (to be retried) instead of completing as 'skipped' while another worker holds a live lease", async () => {
    await DmDelivery.create({
      creatorId,
      eventId: "evt-live",
      status: "reserved",
      claimId: "other-worker",
      leaseExpiresAt: new Date(Date.now() + 20000),
    });

    const error = await failureOf(processDmJob(makeJob("evt-live"), fast));

    expect(error.code).toBe(DM_DELIVERY_IN_PROGRESS);
    expect(global.fetch).not.toHaveBeenCalled();
    expect((await deliveryFor("evt-live")).claimId).toBe("other-worker");
  });

  it("skips jobs that were already sent", async () => {
    await DmDelivery.create({ creatorId, eventId: "evt-done", status: "sent", messageId: "mid.1" });

    expect(await processDmJob(makeJob("evt-done"), fast)).toEqual({ skipped: true, reason: "already_sent" });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
