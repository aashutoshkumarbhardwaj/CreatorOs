const express = require("express");
const mongoose = require("mongoose");
const packageJson = require("../package.json");
const { hasRedisConfig, createRedisClient } = require("../utils/redisClient");

const router = express.Router();

/**
 * GET /health
 * Diagnostic health check endpoint for production uptime monitoring,
 * load balancers (Nginx), and Railway container probes.
 */
router.get("/health", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const isMockDb = process.env.USE_MOCK_DB === "true";

  let dbStatus = "disconnected";
  if (isMockDb) {
    dbStatus = "mock";
  } else if (dbState === 1) {
    dbStatus = "connected";
  } else if (dbState === 2) {
    dbStatus = "connecting";
  } else if (dbState === 3) {
    dbStatus = "disconnecting";
  }

  const isHealthy = dbState === 1 || isMockDb;

  let redisStatus = "not_configured";
  if (hasRedisConfig()) {
    try {
      const redisClient = createRedisClient();
      if (redisClient) {
        if (redisClient.status === "ready" || redisClient.status === "connect") {
          redisStatus = "connected";
        } else {
          redisStatus = "configured";
        }
        if (typeof redisClient.quit === "function") {
          redisClient.quit().catch(() => {});
        }
      }
    } catch (err) {
      redisStatus = "error";
    }
  }

  const memory = process.memoryUsage();

  const status = {
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    redis: redisStatus,
    version: process.env.npm_package_version || packageJson.version || "1.0.0",
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
    },
  };

  const httpStatus = isHealthy ? 200 : 503;
  res.status(httpStatus).json(status);
});

/**
 * GET /metrics
 * Metrics endpoint for production observability.
 * Supports Prometheus text exposition format (default) and JSON format.
 */
router.get("/metrics", async (req, res) => {
  const isMockDb = process.env.USE_MOCK_DB === "true";
  const dbConnected = mongoose.connection.readyState === 1 || isMockDb ? 1 : 0;
  const redisConfigured = hasRedisConfig() ? 1 : 0;
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  const uptime = process.uptime();

  const acceptsJson =
    req.query.format === "json" ||
    (req.headers.accept && req.headers.accept.includes("application/json"));

  if (acceptsJson) {
    return res.json({
      uptime_seconds: uptime,
      process_cpu_user_seconds: cpu.user / 1e6,
      process_cpu_system_seconds: cpu.system / 1e6,
      memory_bytes: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external || 0,
      },
      database_connected: dbConnected,
      redis_configured: redisConfigured,
      timestamp: new Date().toISOString(),
    });
  }

  const metricsText = [
    "# HELP process_uptime_seconds Process uptime in seconds.",
    "# TYPE process_uptime_seconds gauge",
    `process_uptime_seconds ${uptime}`,
    "",
    "# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.",
    "# TYPE process_cpu_user_seconds_total counter",
    `process_cpu_user_seconds_total ${(cpu.user / 1e6).toFixed(6)}`,
    "",
    "# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds.",
    "# TYPE process_cpu_system_seconds_total counter",
    `process_cpu_system_seconds_total ${(cpu.system / 1e6).toFixed(6)}`,
    "",
    "# HELP nodejs_heap_size_total_bytes Process memory heap total bytes.",
    "# TYPE nodejs_heap_size_total_bytes gauge",
    `nodejs_heap_size_total_bytes ${memory.heapTotal}`,
    "",
    "# HELP nodejs_heap_size_used_bytes Process memory heap used bytes.",
    "# TYPE nodejs_heap_size_used_bytes gauge",
    `nodejs_heap_size_used_bytes ${memory.heapUsed}`,
    "",
    "# HELP nodejs_external_memory_bytes Process external memory bytes.",
    "# TYPE nodejs_external_memory_bytes gauge",
    `nodejs_external_memory_bytes ${memory.external || 0}`,
    "",
    "# HELP creatoros_database_connected Database connection status (1 = connected, 0 = disconnected).",
    "# TYPE creatoros_database_connected gauge",
    `creatoros_database_connected ${dbConnected}`,
    "",
    "# HELP creatoros_redis_configured Redis configuration status (1 = configured, 0 = not configured).",
    "# TYPE creatoros_redis_configured gauge",
    `creatoros_redis_configured ${redisConfigured}`,
    "",
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(metricsText);
});

module.exports = router;
