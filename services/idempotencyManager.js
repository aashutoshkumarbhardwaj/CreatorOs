const crypto = require("crypto");
const IdempotencyRecord = require("../model/idempotencyRecord");

/**
 * Generate SHA-256 hash of normalized payload
 */
function computePayloadHash(body = {}) {
  const serialized = JSON.stringify(body || {});
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

/**
 * Attempt to acquire idempotency lock or retrieve cached response
 */
async function acquireOrRetrieve(idempotencyKey, path, body, creatorId, ttlHours = 24) {
  const hash = computePayloadHash(body);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  try {
    const existing = await IdempotencyRecord.findOne({ idempotencyKey });
    if (existing) {
      // 1. If payload hash differs, reject key reuse with different parameters
      if (existing.requestHash !== hash) {
        return {
          action: "reject_conflict",
          message: "Idempotency-Key reuse error: The provided payload does not match the original request.",
          statusCode: 422,
        };
      }

      // 2. If request is still processing
      if (existing.status === "in_flight") {
        return {
          action: "in_flight",
          message: "A request with this Idempotency-Key is currently in progress. Please retry shortly.",
          statusCode: 409,
        };
      }

      // 3. Return cached response
      return {
        action: "replay_cached",
        responseStatusCode: existing.responseStatusCode || 200,
        responseBody: existing.responseBody,
      };
    }

    // Try to reserve atomically
    const record = new IdempotencyRecord({
      idempotencyKey,
      creatorId,
      requestPath: path,
      requestHash: hash,
      status: "in_flight",
      expiresAt,
    });
    await record.save();

    return { action: "proceed", recordId: record._id };
  } catch (err) {
    if (err.code === 11000) {
      // Race condition duplicate key
      return {
        action: "in_flight",
        message: "Concurrent request with identical Idempotency-Key in flight.",
        statusCode: 409,
      };
    }
    throw err;
  }
}

/**
 * Save resolved response into idempotency store
 */
async function resolveIdempotency(idempotencyKey, statusCode, responseBody) {
  await IdempotencyRecord.findOneAndUpdate(
    { idempotencyKey },
    {
      $set: {
        status: "resolved",
        responseStatusCode: statusCode,
        responseBody,
      },
    }
  );
}

/**
 * Mark idempotency as failed to release lock
 */
async function failIdempotency(idempotencyKey) {
  await IdempotencyRecord.findOneAndUpdate(
    { idempotencyKey },
    {
      $set: {
        status: "failed",
      },
    }
  );
}

module.exports = {
  computePayloadHash,
  acquireOrRetrieve,
  resolveIdempotency,
  failIdempotency,
};
