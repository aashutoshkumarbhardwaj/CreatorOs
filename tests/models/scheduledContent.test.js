const ScheduledContent = require("../../model/scheduledContent");

describe("ScheduledContent platform schema", () => {
  it("declares platform only once and keeps all supported platforms as valid values", () => {
    const platformPath = ScheduledContent.schema.path("platform");

    expect(platformPath).toBeDefined();
    expect(platformPath.options.enum).toEqual([
      "instagram",
      "youtube",
      "twitter",
      "tiktok",
      "linkedin",
      "blog",
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

  it("accepts linkedin scheduled content", () => {
    const content = new ScheduledContent({
      userId: "507f1f77bcf86cd799439011",
      contentOsId: "507f1f77bcf86cd799439012",
      caption: "Professional LinkedIn post",
      platform: "linkedin",
      timezone: "UTC",
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(content.validateSync()).toBeUndefined();
  });

  it("accepts blog scheduled content", () => {
    const content = new ScheduledContent({
      userId: "507f1f77bcf86cd799439011",
      contentOsId: "507f1f77bcf86cd799439013",
      caption: "New blog post release announcement",
      platform: "blog",
      timezone: "UTC",
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(content.validateSync()).toBeUndefined();
  });

  it("rejects unsupported platforms", () => {
    const content = new ScheduledContent({
      userId: "507f1f77bcf86cd799439011",
      caption: "Unsupported platform content",
      platform: "myspace",
      timezone: "UTC",
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const err = content.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.platform).toBeDefined();
  });
});
