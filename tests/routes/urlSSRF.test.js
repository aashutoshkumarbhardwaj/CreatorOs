const request = require("supertest");
const express = require("express");
const { handleGenerateShortURL } = require("../../controller/url");
const Url = require("../../model/url");
const mongoose = require("mongoose");

jest.mock("../../model/url");

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  req.user = { id: new mongoose.Types.ObjectId().toString(), role: "creator" };
  next();
});

app.post("/api/url", handleGenerateShortURL);

describe("SSRF Protection in URL Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reject URLs pointing to 169.254.169.254 (AWS Meta-data)", async () => {
    const res = await request(app)
      .post("/api/url")
      .send({ url: "http://169.254.169.254/latest/meta-data/" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/private or internal network address/i);
    expect(Url.create).not.toHaveBeenCalled();
  });

  it("should reject URLs pointing to localhost/127.0.0.1", async () => {
    const res = await request(app)
      .post("/api/url")
      .send({ url: "http://127.0.0.1:27017" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/private or internal network address/i);
    expect(Url.create).not.toHaveBeenCalled();
  });
  
  it("should reject URLs pointing to 10.x.x.x internal IPs", async () => {
    const res = await request(app)
      .post("/api/url")
      .send({ url: "http://10.0.0.5/admin" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/private or internal network address/i);
    expect(Url.create).not.toHaveBeenCalled();
  });

  it("should reject URLs pointing to [::1] IPv6 localhost", async () => {
    const res = await request(app)
      .post("/api/url")
      .send({ url: "http://[::1]:8080/metrics" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/private or internal network address/i);
    expect(Url.create).not.toHaveBeenCalled();
  });

});
