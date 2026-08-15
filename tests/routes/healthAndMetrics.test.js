const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const healthRoutes = require("../../routes/health");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/", healthRoutes);
  return app;
}

describe("Health and Metrics Routes", () => {
  const originalEnv = process.env.USE_MOCK_DB;

  afterEach(() => {
    process.env.USE_MOCK_DB = originalEnv;
    delete mongoose.connection.readyState;
  });

  describe("GET /health", () => {
    it("returns HTTP 200 and ok status when USE_MOCK_DB is true", async () => {
      process.env.USE_MOCK_DB = "true";
      const app = createApp();
      const res = await request(app).get("/health");

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.database).toBe("mock");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("version");
      expect(res.body).toHaveProperty("memory");
      expect(res.body.memory).toHaveProperty("rssMb");
      expect(res.body.memory).toHaveProperty("heapUsedMb");
    });

    it("returns HTTP 503 and degraded status when database is disconnected", async () => {
      delete process.env.USE_MOCK_DB;
      Object.defineProperty(mongoose.connection, "readyState", {
        get: () => 0,
        configurable: true,
      });

      const app = createApp();
      const res = await request(app).get("/health");

      expect(res.statusCode).toBe(503);
      expect(res.body.status).toBe("degraded");
      expect(res.body.database).toBe("disconnected");
    });

    it("returns HTTP 200 and ok status when mongoose.connection.readyState is 1", async () => {
      delete process.env.USE_MOCK_DB;
      Object.defineProperty(mongoose.connection, "readyState", {
        get: () => 1,
        configurable: true,
      });

      const app = createApp();
      const res = await request(app).get("/health");

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.database).toBe("connected");
    });
  });

  describe("GET /metrics", () => {
    it("returns Prometheus text metrics by default", async () => {
      const app = createApp();
      const res = await request(app).get("/metrics");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("process_uptime_seconds");
      expect(res.text).toContain("creatoros_database_connected");
      expect(res.text).toContain("nodejs_heap_size_used_bytes");
    });

    it("returns JSON metrics when format=json query parameter is passed", async () => {
      const app = createApp();
      const res = await request(app).get("/metrics?format=json");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.body).toHaveProperty("uptime_seconds");
      expect(res.body).toHaveProperty("memory_bytes");
      expect(res.body).toHaveProperty("database_connected");
      expect(res.body).toHaveProperty("redis_configured");
    });

    it("returns JSON metrics when Accept header includes application/json", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/metrics")
        .set("Accept", "application/json");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.body).toHaveProperty("uptime_seconds");
      expect(res.body).toHaveProperty("database_connected");
    });
  });

  describe("index.js Route Mounting Verification", () => {
    it("mounts healthRoutes before generateCsrf middleware in index.js", () => {
      const source = fs.readFileSync(path.join(__dirname, "../../index.js"), "utf8");
      const healthMountIndex = source.indexOf("app.use(\"/\", healthRoutes)");
      const csrfMountIndex = source.indexOf("app.use(generateCsrf)");

      expect(healthMountIndex).toBeGreaterThan(-1);
      expect(csrfMountIndex).toBeGreaterThan(-1);
      expect(healthMountIndex).toBeLessThan(csrfMountIndex);
    });
  });
});
