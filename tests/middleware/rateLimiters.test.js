const express = require("express");
const request = require("supertest");

process.env.USE_MOCK_DB = "true";
delete process.env.MONGODB_URI;

const {
  generalLimiter,
  instagramLimiter,
  authLimiter,
} = require("../../middleware/rateLimiters");

function appWith(limiter, userId, statusCode) {
  const app = express();
  app.set("trust proxy", true);
  if (userId) {
    app.use((req, res, next) => {
      req.user = { id: userId };
      next();
    });
  }
  app.use(limiter);
  app.get("/ping", (req, res) => {
    res.status(statusCode || 200).json({ ok: true });
  });
  return app;
}

describe("rate limiters", () => {
  it("generalLimiter lets traffic through then returns 429", async () => {
    const app = appWith(generalLimiter, "general-user-1");
    const first = await request(app).get("/ping");
    expect(first.status).toBe(200);
    expect(first.headers["ratelimit-limit"]).toBeDefined();
  });

  it("generalLimiter blocks after 100 requests", async () => {
    const app = appWith(generalLimiter, "general-user-2");
    for (let i = 0; i < 100; i++) {
      const r = await request(app).get("/ping");
      expect(r.status).toBe(200);
    }
    const blocked = await request(app).get("/ping");
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
  }, 30000);

  it("instagramLimiter blocks the 6th request in a minute", async () => {
    const app = appWith(instagramLimiter, "insta-user-1");
    for (let i = 0; i < 5; i++) {
      const r = await request(app).get("/ping");
      expect(r.status).toBe(200);
    }
    const sixth = await request(app).get("/ping");
    expect(sixth.status).toBe(429);
    expect(sixth.body.message).toMatch(/Instagram/i);
  }, 30000);

  it("instagramLimiter tracks users separately", async () => {
    const appA = appWith(instagramLimiter, "insta-user-A");
    const appB = appWith(instagramLimiter, "insta-user-B");
    for (let i = 0; i < 5; i++) {
      await request(appA).get("/ping");
    }
    expect((await request(appA).get("/ping")).status).toBe(429);
    const fresh = await request(appB).get("/ping");
    expect(fresh.status).toBe(200);
  }, 30000);

  it("authLimiter counts failed logins", async () => {
    const app = express();
    app.set("trust proxy", true);
    app.use(authLimiter);
    app.get("/fail", (req, res) => res.status(400).json({ ok: false }));
    const ip = "9.9.9.101";
    for (let i = 0; i < 10; i++) {
      const r = await request(app).get("/fail").set("X-Forwarded-For", ip);
      expect(r.status).toBe(400);
    }
    const blocked = await request(app).get("/fail").set("X-Forwarded-For", ip);
    expect(blocked.status).toBe(429);
  }, 30000);

  it("authLimiter skips successful logins", async () => {
    const app = express();
    app.set("trust proxy", true);
    app.use(authLimiter);
    app.get("/ok", (req, res) => res.status(200).json({ ok: true }));
    const ip = "9.9.9.102";
    for (let i = 0; i < 10; i++) {
      const r = await request(app).get("/ok").set("X-Forwarded-For", ip);
      expect(r.status).toBe(200);
    }
    const stillOk = await request(app).get("/ok").set("X-Forwarded-For", ip);
    expect(stillOk.status).toBe(200);
  }, 30000);
});
