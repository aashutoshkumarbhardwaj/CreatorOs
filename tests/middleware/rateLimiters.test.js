'use strict';

/**
 * Integration tests for the rate limiting middleware
 * (generalLimiter, instagramLimiter, authLimiter).
 *
 * Complements tests/rateLimiter.test.js (signupLimiter and basic checks) by
 * covering limit boundaries, window expiry, per-client isolation, the exact 429
 * body, rate-limit headers / Retry-After, and skipSuccessfulRequests semantics.
 *
 * Approach
 * - The REAL limiters are mounted on a tiny Express app with probe routes, so
 *   limits, windows, key generation, skipSuccessfulRequests and headers are
 *   exercised end to end through HTTP (supertest).
 * - Limiter modules are re-required before every test (jest.resetModules), so
 *   each test starts with a fresh in-memory store and no state leaks.
 * - MONGODB_URI is removed and rate-limit-mongo is mocked to throw, so the
 *   tests can never touch a database.
 * - Only `Date` is faked (jest fake timers), so window expiry is tested
 *   instantly while supertest's real network I/O keeps working.
 */

// ---------------------------------------------------------------------------
// CONFIG - adjust to match the repo (see step 3 of the guide)
// ---------------------------------------------------------------------------
const LIMITER_MODULE = '../../middleware/rateLimiters';
// Only set this if the repo exports an Express app WITHOUT starting a server /
// connecting to a DB on require (e.g. '../../app'). Leave null otherwise.
const APP_MODULE = null;
// ---------------------------------------------------------------------------

const express = require('express');
const request = require('supertest');

jest.mock('rate-limit-mongo', () =>
  jest.fn(() => {
    throw new Error('MongoStore must not be used in tests');
  })
);

const MINUTE = 60 * 1000;
const WINDOWS = {
  general: {
    limit: 100,
    windowMs: 15 * MINUTE,
    message: 'Too many requests, please try again later.',
  },
  instagram: {
    limit: 5,
    windowMs: 1 * MINUTE,
    message: 'Instagram API rate limit reached. Please wait.',
  },
  auth: {
    limit: 10,
    windowMs: 15 * MINUTE,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
};

const ALL_FAKEABLE = [
  'Date', 'hrtime', 'nextTick', 'performance', 'queueMicrotask',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
  'clearInterval', 'setTimeout', 'clearTimeout',
];

function fakeOnlyDate() {
  jest.useFakeTimers({
    now: Date.now(),
    doNotFake: ALL_FAKEABLE.filter((name) => name !== 'Date'),
  });
}

function advance(ms) {
  jest.setSystemTime(Date.now() + ms);
}

function loadLimiters() {
  jest.resetModules();
  delete process.env.MONGODB_URI;
  process.env.USE_MOCK_DB = 'true';
  process.env.NODE_ENV = 'test';
  const mod = require(LIMITER_MODULE);
  const { generalLimiter, instagramLimiter, authLimiter } = mod;
  for (const [name, fn] of Object.entries({ generalLimiter, instagramLimiter, authLimiter })) {
    if (typeof fn !== 'function') {
      throw new Error(`${LIMITER_MODULE} does not export "${name}" as a middleware function`);
    }
  }
  return { generalLimiter, instagramLimiter, authLimiter };
}

function buildApp({ generalLimiter, instagramLimiter, authLimiter }) {
  const app = express();
  // Trust only the loopback hop so X-Forwarded-For can simulate distinct clients.
  app.set('trust proxy', 'loopback');
  app.use(express.json());

  // Simulates an authenticated user for limiters that key on the user.
  app.use((req, _res, next) => {
    const uid = req.get('x-test-user');
    if (uid) {
      req.user = { id: uid, _id: uid, userId: uid };
      req.userId = uid;
    }
    next();
  });

  app.use('/api', generalLimiter);
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));

  app.post('/probe/instagram', instagramLimiter, (_req, res) => res.json({ ok: true }));

  app.post('/probe/login', authLimiter, (req, res) => {
    if (req.body && req.body.password === 'correct') return res.status(200).json({ ok: true });
    return res.status(401).json({ error: 'Invalid credentials' });
  });

  return app;
}

/** A distinct simulated client: its own IP and its own user id. */
function client(n) {
  return { 'X-Forwarded-For': `203.0.113.${n}`, 'X-Test-User': `user-${n}` };
}

function readRateLimitInfo(res) {
  const h = res.headers;
  if (h['ratelimit-limit'] !== undefined) {
    return { limit: Number(h['ratelimit-limit']), remaining: Number(h['ratelimit-remaining']) };
  }
  if (h.ratelimit) {
    const m = /limit=(\d+),\s*remaining=(\d+)/.exec(h.ratelimit);
    if (m) return { limit: Number(m[1]), remaining: Number(m[2]) };
  }
  if (h['x-ratelimit-limit'] !== undefined) {
    return { limit: Number(h['x-ratelimit-limit']), remaining: Number(h['x-ratelimit-remaining']) };
  }
  return null;
}

function expectRateLimited(res, { windowMs, message }) {
  expect(res.status).toBe(429);
  expect(res.body).toEqual({ success: false, message, error: message });

  const info = readRateLimitInfo(res);
  expect(info).not.toBeNull();
  expect(info.remaining).toBe(0);

  const retryAfter = Number(res.headers['retry-after']);
  expect(Number.isInteger(retryAfter)).toBe(true);
  expect(retryAfter).toBeGreaterThan(0);
  expect(retryAfter).toBeLessThanOrEqual(Math.ceil(windowMs / 1000));
}

describe('rate limiting middleware', () => {
  let server;
  let api;

  beforeEach(() => {
    fakeOnlyDate();
    const app = buildApp(loadLimiters());
    server = app.listen(0);
    api = () => request(server);
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (server) {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // Accept: application/json keeps handlers that use wantsHtml(req) on their JSON path.
  const JSON_ACCEPT = { Accept: 'application/json' };
  const hitGeneral = (headers) => api().get('/api/ping').set({ ...JSON_ACCEPT, ...headers });
  const hitInstagram = (headers) =>
    api().post('/probe/instagram').set({ ...JSON_ACCEPT, ...headers }).send({});
  const login = (headers, password) =>
    api().post('/probe/login').set({ ...JSON_ACCEPT, ...headers }).send({ password });

  // -------------------------------------------------------------------------
  describe('generalLimiter', () => {
    const { limit, windowMs } = WINDOWS.general;
    const expected = WINDOWS.general;

    it(`allows ${limit} requests and blocks the next one with 429`, async () => {
      const c = client(1);
      for (let i = 1; i <= limit; i += 1) {
        const res = await hitGeneral(c);
        if (res.status !== 200) throw new Error(`request ${i} returned ${res.status}, expected 200`);
      }
      expectRateLimited(await hitGeneral(c), expected);
    });

    it('reports the configured limit and a decreasing remaining count', async () => {
      const c = client(2);
      const first = readRateLimitInfo(await hitGeneral(c));
      const second = readRateLimitInfo(await hitGeneral(c));
      expect(first).not.toBeNull();
      expect(first.limit).toBe(limit);
      expect(first.remaining).toBe(limit - 1);
      expect(second.remaining).toBe(limit - 2);
    });

    it('tracks clients independently', async () => {
      const a = client(3);
      const b = client(4);
      for (let i = 0; i < limit; i += 1) await hitGeneral(a);
      expect((await hitGeneral(a)).status).toBe(429);
      expect((await hitGeneral(b)).status).toBe(200);
    });

    it('resets after the window elapses', async () => {
      const c = client(5);
      for (let i = 0; i < limit; i += 1) await hitGeneral(c);
      expect((await hitGeneral(c)).status).toBe(429);

      advance(windowMs - 5000);
      expect((await hitGeneral(c)).status).toBe(429);

      advance(10 * 1000);
      expect((await hitGeneral(c)).status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  describe('instagramLimiter', () => {
    const { limit, windowMs } = WINDOWS.instagram;
    const expected = WINDOWS.instagram;

    it(`allows ${limit} requests per minute and returns 429 on request ${limit + 1}`, async () => {
      const c = client(10);
      for (let i = 1; i <= limit; i += 1) {
        const res = await hitInstagram(c);
        if (res.status !== 200) throw new Error(`request ${i} returned ${res.status}, expected 200`);
      }
      expectRateLimited(await hitInstagram(c), expected);
    });

    it('reports the configured limit', async () => {
      const info = readRateLimitInfo(await hitInstagram(client(11)));
      expect(info).not.toBeNull();
      expect(info.limit).toBe(limit);
    });

    it('tracks each user/IP separately', async () => {
      const a = client(12);
      const b = client(13);
      for (let i = 0; i < limit; i += 1) await hitInstagram(a);
      expect((await hitInstagram(a)).status).toBe(429);
      expect((await hitInstagram(b)).status).toBe(200);
    });

    it('allows requests again after one minute', async () => {
      const c = client(14);
      for (let i = 0; i < limit; i += 1) await hitInstagram(c);
      expect((await hitInstagram(c)).status).toBe(429);

      advance(windowMs - 5000);
      expect((await hitInstagram(c)).status).toBe(429);

      advance(10 * 1000);
      expect((await hitInstagram(c)).status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  describe('authLimiter', () => {
    const { limit, windowMs } = WINDOWS.auth;
    const expected = WINDOWS.auth;

    it(`counts failed logins and blocks attempt ${limit + 1} with 429`, async () => {
      const c = client(20);
      for (let i = 1; i <= limit; i += 1) {
        const res = await login(c, 'wrong');
        if (res.status !== 401) throw new Error(`attempt ${i} returned ${res.status}, expected 401`);
      }
      expectRateLimited(await login(c, 'wrong'), expected);
    });

    it('does not count successful logins (skipSuccessfulRequests)', async () => {
      const c = client(21);
      for (let i = 0; i < limit * 3; i += 1) {
        const res = await login(c, 'correct');
        if (res.status !== 200) throw new Error(`successful login ${i + 1} returned ${res.status}`);
      }
      // The failed-attempt budget must be untouched by the successes above.
      for (let i = 1; i <= limit; i += 1) {
        const res = await login(c, 'wrong');
        if (res.status !== 401) throw new Error(`failed attempt ${i} returned ${res.status}, expected 401`);
      }
      expect((await login(c, 'wrong')).status).toBe(429);
    });

    it('only failures consume the budget when successes are interleaved', async () => {
      const c = client(22);
      // limit - 1 failures, each followed by a success that must still be allowed
      for (let i = 0; i < limit - 1; i += 1) {
        expect((await login(c, 'wrong')).status).toBe(401);
        expect((await login(c, 'correct')).status).toBe(200);
      }
      // The final failure still fits in the budget (it is failure number `limit`)...
      expect((await login(c, 'wrong')).status).toBe(401);
      // ...and the next attempt is blocked.
      expect((await login(c, 'wrong')).status).toBe(429);
    });

    it('blocks even valid credentials once the failure limit is reached', async () => {
      const c = client(23);
      for (let i = 0; i < limit; i += 1) await login(c, 'wrong');
      expect((await login(c, 'correct')).status).toBe(429);
    });

    it('tracks clients independently', async () => {
      const a = client(24);
      const b = client(25);
      for (let i = 0; i < limit; i += 1) await login(a, 'wrong');
      expect((await login(a, 'wrong')).status).toBe(429);
      expect((await login(b, 'wrong')).status).toBe(401);
    });

    it('allows attempts again after the window elapses', async () => {
      const c = client(26);
      for (let i = 0; i < limit; i += 1) await login(c, 'wrong');
      expect((await login(c, 'wrong')).status).toBe(429);

      advance(windowMs - 5000);
      expect((await login(c, 'wrong')).status).toBe(429);

      advance(10 * 1000);
      expect((await login(c, 'wrong')).status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// Optional wiring check against the real app (enable via APP_MODULE above).
// Guards against a limiter being removed from the real /api mount.
// ---------------------------------------------------------------------------
const describeWiring = APP_MODULE ? describe : describe.skip;

describeWiring('generalLimiter wiring on the real app', () => {
  it('rate limits /api routes', async () => {
    jest.resetModules();
    delete process.env.MONGODB_URI;
    process.env.USE_MOCK_DB = 'true';
    process.env.NODE_ENV = 'test';
    const loaded = require(APP_MODULE);
    const app = loaded.app || loaded.default || loaded;
    const server = app.listen(0);
    try {
      let lastStatus;
      for (let i = 0; i < WINDOWS.general.limit + 1; i += 1) {
        // An unknown /api path still passes through the limiter first.
        lastStatus = (await request(server).get('/api/__rate_limit_probe__')).status;
      }
      expect(lastStatus).toBe(429);
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
