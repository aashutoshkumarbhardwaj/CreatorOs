const { parseVisitCoordinates } = require("../../utils/visitTelemetry");

describe("visit telemetry coordinates", () => {
  it("returns finite coordinates when both query values are valid numbers", () => {
    expect(parseVisitCoordinates({ x: "12.5", y: "3" })).toEqual({ x: 12.5, y: 3 });
  });

  it("ignores coordinates when either value is missing", () => {
    expect(parseVisitCoordinates({ x: "12.5" })).toBeNull();
    expect(parseVisitCoordinates({ y: "3" })).toBeNull();
  });

  it("ignores NaN and infinite coordinates", () => {
    expect(parseVisitCoordinates({ x: "abc", y: "3" })).toBeNull();
    expect(parseVisitCoordinates({ x: "NaN", y: "3" })).toBeNull();
    expect(parseVisitCoordinates({ x: "Infinity", y: "3" })).toBeNull();
    expect(parseVisitCoordinates({ x: "3", y: "-Infinity" })).toBeNull();
  });
});
