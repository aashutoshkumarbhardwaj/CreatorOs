const { acquireOrRetrieve, resolveIdempotency, failIdempotency } = require("../services/idempotencyManager");

/**
 * Express middleware to enforce idempotency on mutating operations
 */
function idempotencyGuard(options = {}) {
  return async (req, res, next) => {
    // Only apply to mutating methods
    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      return next();
    }

    const key =
      req.headers["idempotency-key"] ||
      req.headers["x-idempotency-key"] ||
      req.headers["x-event-id"];

    // If client provided no idempotency key, proceed normally
    if (!key) {
      return next();
    }

    const creatorId = req.user && req.user._id ? req.user._id : null;

    try {
      const decision = await acquireOrRetrieve(key, req.originalUrl, req.body, creatorId);

      if (decision.action === "reject_conflict" || decision.action === "in_flight") {
        return res.status(decision.statusCode).json({
          success: false,
          error: decision.action,
          message: decision.message,
        });
      }

      if (decision.action === "replay_cached") {
        res.setHeader("X-Cache-Lookup", "HIT-IDEMPOTENT");
        return res.status(decision.responseStatusCode).json(decision.responseBody);
      }

      // Intercept res.json to capture response payload automatically
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolveIdempotency(key, res.statusCode, body).catch((err) =>
            console.error("Failed to save idempotency response:", err)
          );
        } else {
          failIdempotency(key).catch((err) => console.error("Failed to release idempotency key:", err));
        }
        return originalJson(body);
      };

      return next();
    } catch (err) {
      console.error("Idempotency guard error:", err);
      return next();
    }
  };
}

module.exports = idempotencyGuard;
