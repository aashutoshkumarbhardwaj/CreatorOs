const crypto = require("crypto");

// Delete the key only if it still holds OUR token (compare-and-delete).
const RELEASE_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

/**
 * Creates an owner-aware mutex.
 *
 * Every successful acquire() returns a unique token and release() only frees the
 * lock if the caller still owns it. Without that ownership check a request whose
 * lock already expired (TTL elapsed during a slow external call) would delete the
 * lock now held by a *different* request and silently re-open the critical section.
 *
 * @param {object|null} redisClient ioredis client, Upstash REST wrapper, or null (in-memory fallback)
 */
function createLockManager(redisClient) {
  const memoryLocks = new Map();

  /** @returns {Promise<string|null>} lock token, or null when the lock is held elsewhere */
  async function acquire(key, ttlSeconds) {
    const token = crypto.randomUUID();

    if (!redisClient) {
      if (memoryLocks.has(key)) return null;
      const timer = setTimeout(() => {
        const current = memoryLocks.get(key);
        if (current && current.token === token) memoryLocks.delete(key);
      }, ttlSeconds * 1000);
      if (typeof timer.unref === "function") timer.unref();
      memoryLocks.set(key, { token, timer });
      return token;
    }

    try {
      const result = await redisClient.set(key, token, "EX", ttlSeconds, "NX");
      return result === "OK" ? token : null;
    } catch (err) {
      console.error("[Mutex] Redis lock error:", err);
      return null;
    }
  }

  async function release(key, token) {
    if (!token) return false;

    if (!redisClient) {
      const current = memoryLocks.get(key);
      if (!current || current.token !== token) return false;
      clearTimeout(current.timer);
      memoryLocks.delete(key);
      return true;
    }

    try {
      if (typeof redisClient.eval === "function") {
        return (await redisClient.eval(RELEASE_SCRIPT, 1, key, token)) === 1;
      }
      // Upstash REST wrapper has no EVAL: best-effort compare-then-delete.
      if ((await redisClient.get(key)) === token) {
        await redisClient.del(key);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[Mutex] Redis unlock error:", err);
      return false;
    }
  }

  return { acquire, release };
}

module.exports = { createLockManager, RELEASE_SCRIPT };
