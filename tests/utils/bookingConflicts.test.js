const {
  PENDING_SYNC_TTL_MS,
  buildBlockingBookingQuery,
  lostBookingRace,
} = require("../../utils/bookingConflicts");

const userId = "507f1f77bcf86cd799439011";
const start = new Date("2026-10-01T10:00:00.000Z");
const end = new Date("2026-10-01T11:00:00.000Z");
const MIN = 60 * 1000;

describe("buildBlockingBookingQuery", () => {
  it("keeps exact back-to-back bookings allowed when there are no buffers", () => {
    const q = buildBlockingBookingQuery({ userId, start, end });
    expect(q.startTime.$lt).toEqual(end);
    expect(q.endTime.$gt).toEqual(start);
  });

  it("widens the window by the event type buffers (same rule as the slot list)", () => {
    const q = buildBlockingBookingQuery({ userId, start, end, bufferBeforeMs: 15 * MIN, bufferAfterMs: 10 * MIN });
    expect(q.startTime.$lt).toEqual(new Date(end.getTime() + 15 * MIN));
    expect(q.endTime.$gt).toEqual(new Date(start.getTime() - 10 * MIN));
  });

  it("blocks on scheduled bookings and only FRESH pending_sync bookings", () => {
    const now = new Date("2026-10-01T09:00:00.000Z");
    const q = buildBlockingBookingQuery({ userId, start, end, now });
    expect(q.$or).toEqual([
      { status: "scheduled" },
      { status: "pending_sync", createdAt: { $gte: new Date(now.getTime() - PENDING_SYNC_TTL_MS) } },
    ]);
  });

  it("can exclude the caller's own reservation", () => {
    const q = buildBlockingBookingQuery({ userId, start, end, excludeId: "abc" });
    expect(q._id).toEqual({ $ne: "abc" });
  });
});

describe("lostBookingRace", () => {
  const mine = { _id: "507f1f77bcf86cd799439022" };

  it("backs off only when a blocking rival exists", async () => {
    const none = { findOne: jest.fn().mockResolvedValue(null) };
    const some = { findOne: jest.fn().mockResolvedValue({ _id: "x", status: "scheduled" }) };
    expect(await lostBookingRace(none, mine, { userId, start, end })).toBe(false);
    expect(await lostBookingRace(some, mine, { userId, start, end })).toBe(true);
  });

  it("asks for confirmed rivals or EARLIER in-flight rivals, never itself", async () => {
    const model = { findOne: jest.fn().mockResolvedValue(null) };
    await lostBookingRace(model, mine, { userId, start, end, bufferBeforeMs: 5 * MIN });

    const query = model.findOne.mock.calls[0][0];
    expect(query._id).toEqual({ $ne: mine._id });
    expect(query.$or[0]).toEqual({ status: "scheduled" });
    expect(query.$or[1].status).toBe("pending_sync");
    expect(query.$or[1]._id).toEqual({ $lt: mine._id });
    expect(query.startTime.$lt).toEqual(new Date(end.getTime() + 5 * MIN));
  });
});
