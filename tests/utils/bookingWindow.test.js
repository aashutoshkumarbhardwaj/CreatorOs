const { checkAvailabilityWindow, getConflictRange } = require("../../utils/bookingWindow");

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];

function check(startISO, durationMin, availability) {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return checkAvailabilityWindow({ start, end, availability });
}

describe("checkAvailabilityWindow", () => {
  const utc = { days: WEEKDAYS, startTime: "09:00", endTime: "17:00", timeZone: "UTC" };

  test("accepts a booking fully inside the window", () => {
    expect(check("2026-10-01T10:00:00.000Z", 60, utc)).toEqual({ ok: true });
  });

  test("accepts bookings that touch the exact window boundaries", () => {
    expect(check("2026-10-01T09:00:00.000Z", 60, utc).ok).toBe(true);
    expect(check("2026-10-01T16:00:00.000Z", 60, utc).ok).toBe(true);
  });

  test("rejects bookings that start before or end after the window", () => {
    expect(check("2026-10-01T08:30:00.000Z", 60, utc).status).toBe(409);
    expect(check("2026-10-01T16:30:00.000Z", 60, utc).status).toBe(409);
  });

  test("rejects a booking that starts late in the evening and crosses local midnight", () => {
    // Regression: start 23:30 >= window start and end 00:30 <= window end used to pass.
    const result = check("2026-10-01T23:30:00.000Z", 60, utc);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.message).toMatch(/outside the event availability window/i);
  });

  test("rejects a late-night booking that would roll into an allowed weekday", () => {
    // Fri 23:30 -> Sat 00:30 (Friday is an allowed day)
    expect(check("2026-10-02T23:30:00.000Z", 60, utc).ok).toBe(false);
  });

  test("rejects days that are not available", () => {
    // 2026-10-03 is a Saturday
    expect(check("2026-10-03T10:00:00.000Z", 60, utc).status).toBe(409);
  });

  test("evaluates the window in the host's timezone (Asia/Colombo, UTC+5:30)", () => {
    const colombo = { ...utc, timeZone: "Asia/Colombo" };
    expect(check("2026-10-01T03:30:00.000Z", 60, colombo).ok).toBe(true); // 09:00 local
    expect(check("2026-10-01T09:00:00.000Z", 60, colombo).ok).toBe(true); // 14:30 local
    expect(check("2026-10-01T12:30:00.000Z", 60, colombo).ok).toBe(false); // 18:00 local
    expect(check("2026-10-01T18:00:00.000Z", 60, colombo).ok).toBe(false); // 23:30 local -> 00:30
  });

  test("derives the weekday from the host's local date, not UTC", () => {
    const colombo = { ...utc, timeZone: "Asia/Colombo" };
    // Fri 20:00Z is already Saturday 01:30 in Colombo
    expect(check("2026-10-02T20:00:00.000Z", 30, colombo).status).toBe(409);
  });

  test("handles DST transitions for IANA zones", () => {
    const ny = { ...utc, timeZone: "America/New_York" };
    // Fri 2026-03-06 is EST (UTC-5): 09:00 local = 14:00Z
    expect(check("2026-03-06T14:00:00.000Z", 60, ny).ok).toBe(true);
    expect(check("2026-03-06T13:00:00.000Z", 60, ny).ok).toBe(false);
    // Mon 2026-03-09 is EDT (UTC-4): 09:00 local = 13:00Z
    expect(check("2026-03-09T13:00:00.000Z", 60, ny).ok).toBe(true);
    expect(check("2026-03-09T12:30:00.000Z", 60, ny).ok).toBe(false);
  });

  test("falls back to the default availability when none is configured", () => {
    expect(check("2026-10-01T10:00:00.000Z", 30, undefined).ok).toBe(true);
    expect(check("2026-10-01T20:00:00.000Z", 30, {}).ok).toBe(false);
  });

  test("returns 400 for an invalid timezone or an empty window", () => {
    expect(check("2026-10-01T10:00:00.000Z", 30, { ...utc, timeZone: "Mars/Olympus" }).status).toBe(400);
    expect(check("2026-10-01T10:00:00.000Z", 30, { ...utc, startTime: "17:00", endTime: "09:00" }).status).toBe(400);
  });
});

describe("getConflictRange", () => {
  const start = new Date("2026-10-01T10:00:00.000Z");
  const end = new Date("2026-10-01T11:00:00.000Z");

  test("without buffers it is a plain overlap test", () => {
    const range = getConflictRange({ start, end });
    expect(range.startTime.$lt.toISOString()).toBe("2026-10-01T11:00:00.000Z");
    expect(range.endTime.$gt.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  test("widens the range by the event type's buffers", () => {
    const range = getConflictRange({ start, end, bufferBefore: 10, bufferAfter: 15 });
    expect(range.startTime.$lt.toISOString()).toBe("2026-10-01T11:10:00.000Z");
    expect(range.endTime.$gt.toISOString()).toBe("2026-10-01T09:45:00.000Z");
  });

  test("ignores missing or non-numeric buffers", () => {
    const range = getConflictRange({ start, end, bufferBefore: undefined, bufferAfter: "abc" });
    expect(range.startTime.$lt.toISOString()).toBe("2026-10-01T11:00:00.000Z");
    expect(range.endTime.$gt.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });
});
