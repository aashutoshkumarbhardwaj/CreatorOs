const { computePayloadHash } = require("../services/idempotencyManager");
const idempotencyGuard = require("../middleware/idempotencyGuard");

describe("Distributed Idempotency Engine Unit Tests", () => {
  describe("computePayloadHash", () => {
    it("should generate consistent SHA-256 hash for identical objects", () => {
      const payload1 = { brand: "Acme", amount: 1500 };
      const payload2 = { brand: "Acme", amount: 1500 };

      const hash1 = computePayloadHash(payload1);
      const hash2 = computePayloadHash(payload2);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("should generate different hashes for distinct payloads", () => {
      const hashA = computePayloadHash({ title: "Video 1" });
      const hashB = computePayloadHash({ title: "Video 2" });

      expect(hashA).not.toBe(hashB);
    });
  });

  describe("idempotencyGuard Middleware Bypass", () => {
    it("should pass non-mutating GET requests directly through next()", async () => {
      const req = { method: "GET", headers: {} };
      const res = {};
      const next = jest.fn();

      const middleware = idempotencyGuard();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should pass through POST requests that lack idempotency keys", async () => {
      const req = { method: "POST", headers: {}, originalUrl: "/api/test", body: {} };
      const res = {};
      const next = jest.fn();

      const middleware = idempotencyGuard();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
