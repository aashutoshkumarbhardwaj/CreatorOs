const {
  parseDateParts,
  zonedDateTimeToUtc,
  localDayName,
  formatTimeInZone,
} = require("../utils/timeZone");

describe("meeting availability timezone helpers", () => {
  test("rejects invalid calendar dates", () => {
    expect(parseDateParts("2026-02-30")).toBeNull();
    expect(parseDateParts("not-a-date")).toBeNull();
  });

  test("keeps UTC availability unchanged", () => {
    const slot = zonedDateTimeToUtc("2026-09-14", "09:00", "UTC");
    expect(slot.toISOString()).toBe("2026-09-14T09:00:00.000Z");
  });

  test("converts Asia/Kolkata local availability to canonical UTC", () => {
    const slot = zonedDateTimeToUtc("2026-09-14", "09:00", "Asia/Kolkata");
    expect(slot.toISOString()).toBe("2026-09-14T03:30:00.000Z");
    expect(formatTimeInZone(slot, "Asia/Kolkata")).toBe("09:00");
  });

  test("handles DST offsets with IANA timezones", () => {
    const summer = zonedDateTimeToUtc("2026-07-01", "09:00", "America/New_York");
    const winter = zonedDateTimeToUtc("2026-01-01", "09:00", "America/New_York");
    expect(summer.toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(winter.toISOString()).toBe("2026-01-01T14:00:00.000Z");
  });

  test("derives weekday from the requested local calendar date", () => {
    expect(localDayName("2026-09-14")).toBe("mon");
    expect(localDayName("2026-09-13")).toBe("sun");
  });

  test("rejects invalid IANA timezone names", () => {
    expect(zonedDateTimeToUtc("2026-09-14", "09:00", "Mars/Olympus")).toBeNull();
  });
});
