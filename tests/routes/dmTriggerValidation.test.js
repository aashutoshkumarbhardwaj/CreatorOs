const express = require("express");
const request = require("supertest");

jest.mock("../../middleware/auth", () => ({
  protect: (req, res, next) => {
    req.user = { _id: "64b7f1f1f1f1f1f1f1f1f1f1" };
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
  find: jest.fn().mockResolvedValue([]),
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

describe("DM trigger payload validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects non-http response URLs", async () => {
    const res = await request(createApp())
      .post("/api/instagram/triggers")
      .send({ keyword: "guide", responseUrl: "ftp://example.com/guide" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Response URL must use HTTP or HTTPS");
    expect(DmTrigger.create).not.toHaveBeenCalled();
  });

  it("normalizes valid trigger payloads before create", async () => {
    DmTrigger.create.mockImplementation(async (payload) => payload);

    const res = await request(createApp())
      .post("/api/instagram/triggers")
      .send({
        keyword: "  GUIDE  ",
        responseUrl: " https://example.com/guide ",
        isActive: true,
        creatorId: "attempted-override",
      });

    expect(res.statusCode).toBe(201);
    expect(DmTrigger.create).toHaveBeenCalledWith({
      keyword: "guide",
      responseUrl: "https://example.com/guide",
      isActive: true,
      creatorId: "64b7f1f1f1f1f1f1f1f1f1f1",
    });
  });
});
