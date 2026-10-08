const { createLockManager } = require("../../utils/bookingLock");

function createFakeRedis() {
  const store = new Map();
  return {
    store,
    async set(key, value, ...opts) {
      if (opts.includes("NX") && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
  };
}

describe.each([
  ["in-memory fallback", () => null],
  ["redis-like client (GET/DEL fallback)", () => createFakeRedis()],
])("bookingLock owner-aware mutex: %s", (_label, makeClient) => {
  it("grants the lock to one caller at a time", async () => {
    const lock = createLockManager(makeClient());
    const t1 = await lock.acquire("k", 15);
    const t2 = await lock.acquire("k", 15);
    expect(t1).toEqual(expect.any(String));
    expect(t2).toBeNull();
  });

  it("lets the lock be re-acquired after the owner releases it", async () => {
    const lock = createLockManager(makeClient());
    const t1 = await lock.acquire("k", 15);
    expect(await lock.release("k", t1)).toBe(true);
    expect(await lock.acquire("k", 15)).toEqual(expect.any(String));
  });

  it("does NOT release a lock now owned by someone else (stale token)", async () => {
    const client = makeClient();
    const lock = createLockManager(client);
    const staleToken = await lock.acquire("k", 15);

    // Simulate TTL expiry of the first holder followed by a second holder acquiring.
    if (client) client.store.delete("k");
    else await lock.release("k", staleToken);
    const ownerToken = await lock.acquire("k", 15);
    expect(ownerToken).not.toBe(staleToken);

    // The first request finishes late and runs its `finally` release.
    expect(await lock.release("k", staleToken)).toBe(false);

    // The second holder must still be protected.
    expect(await lock.acquire("k", 15)).toBeNull();
    expect(await lock.release("k", ownerToken)).toBe(true);
  });

  it("ignores release calls without a token", async () => {
    const lock = createLockManager(makeClient());
    await lock.acquire("k", 15);
    expect(await lock.release("k", undefined)).toBe(false);
    expect(await lock.acquire("k", 15)).toBeNull();
  });
});

describe("bookingLock with ioredis-style EVAL", () => {
  it("uses compare-and-delete via EVAL when available", async () => {
    const store = new Map();
    const client = {
      async set(key, value, ...opts) {
        if (opts.includes("NX") && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      },
      eval: jest.fn(async (_script, _n, key, token) => {
        if (store.get(key) === token) {
          store.delete(key);
          return 1;
        }
        return 0;
      }),
    };
    const lock = createLockManager(client);
    const token = await lock.acquire("k", 15);
    expect(await lock.release("k", "someone-else")).toBe(false);
    expect(store.has("k")).toBe(true);
    expect(await lock.release("k", token)).toBe(true);
    expect(client.eval).toHaveBeenCalledTimes(2);
  });
});
