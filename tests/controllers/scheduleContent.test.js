const mongoose = require("mongoose");

jest.mock("../../model/scheduledContent", () => ({
  create: jest.fn(),
}));

const ScheduledContent = require("../../model/scheduledContent");
const { scheduleContent } = require("../../controller/contentController");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("scheduleContent mediaUrl validation", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      user: { id: "user-id" },
      body: {
        caption: "Launch post",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    };
    res = createResponse();
    jest.clearAllMocks();
  });

  it("rejects unsupported mediaUrl protocols", async () => {
    req.body.mediaUrl = "javascript:alert(1)";

    await scheduleContent(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "mediaUrl must be a valid HTTP or HTTPS URL",
    });
    expect(ScheduledContent.create).not.toHaveBeenCalled();
  });

  it("trims and saves valid HTTP mediaUrl values", async () => {
    req.body.mediaUrl = " https://example.com/media.png ";
    ScheduledContent.create.mockResolvedValue({ _id: "content-id" });

    await scheduleContent(req, res, jest.fn());

    expect(ScheduledContent.create).toHaveBeenCalledWith(expect.objectContaining({
      mediaUrl: "https://example.com/media.png",
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("ScheduledContent platform schema validation", () => {
  const RealScheduledContent = jest.requireActual("../../model/scheduledContent");
  const schemaPaths = RealScheduledContent.schema.paths;

  it("defines the platform path exactly once with the correct enum", () => {
    const platformPath = schemaPaths.platform;
    expect(platformPath).toBeDefined();
    expect(platformPath.enumValues).toEqual(
      expect.arrayContaining(["instagram", "youtube", "twitter", "tiktok", "general"])
    );
    expect(platformPath.enumValues).toHaveLength(5);
  });

  it("defaults platform to instagram", () => {
    expect(schemaPaths.platform.defaultValue).toBe("instagram");
  });

  it("accepts all supported platform values", () => {
    const supported = ["instagram", "youtube", "twitter", "tiktok", "general"];
    for (const value of supported) {
      const doc = new RealScheduledContent({
        userId: new mongoose.Types.ObjectId(),
        caption: "test",
        timezone: "UTC",
        scheduledAt: new Date(),
        platform: value,
      });
      const err = doc.validateSync();
      expect(err?.errors?.platform).toBeUndefined();
    }
  });

  it("rejects unsupported platform values", () => {
    const doc = new RealScheduledContent({
      userId: new mongoose.Types.ObjectId(),
      caption: "test",
      timezone: "UTC",
      scheduledAt: new Date(),
      platform: "facebook",
    });
    const err = doc.validateSync();
    expect(err.errors.platform).toBeDefined();
  });
});
