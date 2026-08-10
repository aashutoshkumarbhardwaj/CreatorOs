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
