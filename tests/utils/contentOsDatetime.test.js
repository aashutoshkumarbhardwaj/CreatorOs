const {
  toDatetimeLocalValue,
  toLocalDateISO,
  datetimeLocalToISO,
} = require("../../public/js/datetimeLocal");

describe("Content OS local datetime helpers", () => {
  it("round-trips an ISO instant through datetime-local without shifting minutes", () => {
    const iso = "2026-09-16T18:30:00.000Z";
    const localValue = toDatetimeLocalValue(iso);

    expect(localValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(datetimeLocalToISO(localValue)).getTime()).toBe(
      new Date(iso).getTime()
    );
  });

  it("keeps calendar data-date on the local calendar day", () => {
    const localMidnight = new Date(2026, 8, 16, 0, 0, 0);
    expect(toLocalDateISO(localMidnight)).toBe("2026-09-16");

    if (localMidnight.getTimezoneOffset() !== 0) {
      expect(toLocalDateISO(localMidnight)).not.toBe(
        localMidnight.toISOString().split("T")[0]
      );
    }
  });

  it("returns empty values for missing or invalid input", () => {
    expect(toDatetimeLocalValue("")).toBe("");
    expect(toDatetimeLocalValue(null)).toBe("");
    expect(toDatetimeLocalValue("not-a-date")).toBe("");
    expect(datetimeLocalToISO("")).toBeNull();
    expect(toLocalDateISO(undefined)).toBe("");
  });
});
