const express = require("express");
const request = require("supertest");

jest.mock("../../middleware/auth", () => ({
  protect: (req, res, next) => {
    req.user = { id: "64b7f1f1f1f1f1f1f1f1f1f1" };
    next();
  },
}));

jest.mock("../../middleware/rateLimiters", () => ({
  instagramProfileLimiter: (req, res, next) => next(),
}));

jest.mock("../../controller/instagramController", () => ({
  getInstagramProfile: jest.fn((req, res) => res.json({ success: true })),
}));

jest.mock("../../controller/instagramWebhookController", () => ({
  verifyWebhook: jest.fn((req, res) => res.sendStatus(200)),
  verifyWebhookSignature: jest.fn((req, res, next) => next()),
  handleWebhook: jest.fn((req, res) => res.sendStatus(200)),
}));

jest.mock("../../model/dmTrigger", () => ({
  find: jest.fn(),
  create: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

const DmTrigger = require("../../model/dmTrigger");
const instagramRoutes = require("../../routes/instagram");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/instagram", instagramRoutes);
  return app;
}

describe("Instagram trigger routes", () => {
  const userId = "64b7f1f1f1f1f1f1f1f1f1f1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists triggers using the JWT user id", async () => {
    DmTrigger.find.mockResolvedValue([{ keyword: "guide" }]);

    const res = await request(createApp()).get("/api/instagram/triggers");

    expect(res.statusCode).toBe(200);
    expect(DmTrigger.find).toHaveBeenCalledWith({ creatorId: userId });
    expect(res.body).toEqual({ success: true, data: [{ keyword: "guide" }] });
  });

  it("creates triggers using the JWT user id", async () => {
    DmTrigger.create.mockResolvedValue({
      keyword: "guide",
      responseUrl: "https://example.com/guide",
      creatorId: userId,
    });

    const payload = {
      keyword: "guide",
      responseUrl: "https://example.com/guide",
    };
    const res = await request(createApp())
      .post("/api/instagram/triggers")
      .send(payload);

    expect(res.statusCode).toBe(201);
    expect(DmTrigger.create).toHaveBeenCalledWith({ ...payload, creatorId: userId });
    expect(res.body.success).toBe(true);
  });

  it("deletes triggers using the JWT user id", async () => {
    DmTrigger.findOneAndDelete.mockResolvedValue({ _id: "trigger-id" });

    const res = await request(createApp()).delete("/api/instagram/triggers/trigger-id");

    expect(res.statusCode).toBe(200);
    expect(DmTrigger.findOneAndDelete).toHaveBeenCalledWith({
      _id: "trigger-id",
      creatorId: userId,
    });
    expect(res.body).toEqual({ success: true, message: "Trigger deleted" });
  });
});
