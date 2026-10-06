const ScheduledContent = require("../../model/scheduledContent");

describe("ScheduledContent platform schema", () => {
  it("declares platform only once and keeps general as a valid value", () => {
    const platformPath = ScheduledContent.schema.path("platform");

    expect(platformPath).toBeDefined();
    expect(platformPath.options.enum).toEqual([
      "instagram",
      "youtube",
      "twitter",
      "tiktok",
      "general",
    ]);
  });

  it("accepts content generated without a platform-specific provider", () => {
    const content = new ScheduledContent({
      userId: "507f1f77bcf86cd799439011",
      caption: "General content",
      platform: "general",
      timezone: "UTC",
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(content.validateSync()).toBeUndefined();
  });
});
