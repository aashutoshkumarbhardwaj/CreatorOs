process.env.USE_MOCK_DB = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-2fa";
process.env.NODE_ENV = "test";

const bcrypt = require("bcryptjs");
const User = require("../../model/user");
const attemptManager = require("../../utils/loginAttemptManager");

// In-memory stand-in for the Redis-backed failed-attempt counters. The spies must be
// installed BEFORE the controller is required: it destructures these functions.
const attempts = new Map();
jest.spyOn(attemptManager, "checkIfLoginLocked").mockImplementation(
  async (id) => (attempts.get(id) || 0) >= attemptManager.MAX_LOGIN_ATTEMPTS
);
jest.spyOn(attemptManager, "recordFailedLoginAttempt").mockImplementation(async (id) => {
  attempts.set(id, (attempts.get(id) || 0) + 1);
});
jest.spyOn(attemptManager, "clearLoginAttempts").mockImplementation(async (id) => {
  attempts.delete(id);
});
jest.spyOn(attemptManager, "getRemainingLoginLockoutTime").mockImplementation(async () => 600);

const { login, verifyLogin2FA } = require("../../controller/auth");
const { generateHotp, decodeBase32 } = require("../../utils/totp");

const EMAIL = "lockout2fa@example.com";
const PASSWORD = "SecretPass123!";
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const MAX = attemptManager.MAX_LOGIN_ATTEMPTS;

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    cookies: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
    render(view, data) {
      res.body = { view, ...data };
      return res;
    },
    redirect(url) {
      res.redirected = url;
      return res;
    },
    cookie(name, value) {
      res.cookies[name] = value;
      return res;
    },
    clearCookie() {
      return res;
    },
  };
  return res;
}

async function post(handler, body, cookies = {}) {
  const res = makeRes();
  const req = {
    body,
    cookies,
    get: () => "application/json",
    accepts: () => "json",
    xhr: true,
  };
  await handler(req, res, (error) => {
    throw error;
  });
  return res;
}

function currentOtp() {
  return generateHotp(decodeBase32(SECRET), Math.floor(Date.now() / 1000 / 30));
}

// 6-digit codes that cannot be valid right now (anything but the three accepted steps).
function wrongOtp(n) {
  const accepted = [-1, 0, 1].map((offset) =>
    generateHotp(decodeBase32(SECRET), Math.floor(Date.now() / 1000 / 30) + offset)
  );
  let candidate = 100000 + n;
  while (accepted.includes(String(candidate))) candidate += 1;
  return String(candidate);
}

describe("2FA login keeps the failed-attempt lockout (password known to the attacker)", () => {
  beforeEach(async () => {
    attempts.clear();
    await User.deleteMany({ email: EMAIL });
    await User.create({
      name: "Lockout 2FA",
      email: EMAIL,
      password: await bcrypt.hash(PASSWORD, 4),
      isVerified: true,
      authProvider: "local",
      twoFactorEnabled: true,
      twoFactorSecret: SECRET,
    });
  });

  it("locks the account after repeated wrong codes sent with the correct password to /login", async () => {
    const statuses = [];
    for (let i = 0; i < MAX + 3; i += 1) {
      const res = await post(login, { email: EMAIL, password: PASSWORD, otp: wrongOtp(i) });
      statuses.push(res.statusCode);
    }

    expect(statuses.slice(0, MAX)).toEqual(Array(MAX).fill(401));
    expect(statuses.slice(MAX)).toEqual([429, 429, 429]);
    expect(attempts.get(EMAIL)).toBe(MAX);
  });

  it("refuses even the CORRECT code once the account is locked", async () => {
    for (let i = 0; i < MAX; i += 1) {
      await post(login, { email: EMAIL, password: PASSWORD, otp: wrongOtp(i) });
    }

    const res = await post(login, { email: EMAIL, password: PASSWORD, otp: currentOtp() });

    expect(res.statusCode).toBe(429);
    expect(res.body.token).toBeUndefined();
  });

  it("does not let a fresh password-only login reset the counter in the middle of an OTP attack", async () => {
    const wrongCodesPerRound = 2;
    const rounds = 4;

    for (let round = 0; round < rounds; round += 1) {
      const challenge = await post(login, { email: EMAIL, password: PASSWORD });
      for (let j = 0; j < wrongCodesPerRound; j += 1) {
        await post(verifyLogin2FA, { otp: wrongOtp(round * 10 + j) }, { pending2fa: challenge.cookies.pending2fa });
      }
    }

    // 4 rounds x 2 wrong codes = 8 guesses were tried; the counter must have stopped the attack at MAX.
    expect(attempts.get(EMAIL)).toBe(MAX);
  });

  it("blocks /login/2fa once the account is locked", async () => {
    const challenge = await post(login, { email: EMAIL, password: PASSWORD });
    for (let i = 0; i < MAX; i += 1) {
      await post(verifyLogin2FA, { otp: wrongOtp(i) }, { pending2fa: challenge.cookies.pending2fa });
    }

    const res = await post(verifyLogin2FA, { otp: currentOtp() }, { pending2fa: challenge.cookies.pending2fa });

    expect(res.statusCode).toBe(429);
    expect(res.body.token).toBeUndefined();
  });

  it("keeps earlier failures when the password is right but no code was supplied yet", async () => {
    await post(login, { email: EMAIL, password: "wrong-password" });
    await post(login, { email: EMAIL, password: "wrong-password" });
    expect(attempts.get(EMAIL)).toBe(2);

    const challenge = await post(login, { email: EMAIL, password: PASSWORD });

    expect(challenge.body.requires2FA).toBe(true);
    expect(attempts.get(EMAIL)).toBe(2);
  });

  it("clears the counter only after the second factor succeeds", async () => {
    await post(login, { email: EMAIL, password: PASSWORD, otp: wrongOtp(1) });
    await post(login, { email: EMAIL, password: PASSWORD, otp: wrongOtp(2) });
    expect(attempts.get(EMAIL)).toBe(2);

    const res = await post(login, { email: EMAIL, password: PASSWORD, otp: currentOtp() });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(attempts.get(EMAIL)).toBeUndefined();
  });
});

describe("2FA login rejects a replayed code", () => {
  beforeEach(async () => {
    attempts.clear();
    await User.deleteMany({ email: EMAIL });
    await User.create({
      name: "Replay 2FA",
      email: EMAIL,
      password: await bcrypt.hash(PASSWORD, 4),
      isVerified: true,
      authProvider: "local",
      twoFactorEnabled: true,
      twoFactorSecret: SECRET,
    });
  });

  it("accepts a code once on /login and refuses the same code afterwards", async () => {
    const otp = currentOtp();

    const first = await post(login, { email: EMAIL, password: PASSWORD, otp });
    const replay = await post(login, { email: EMAIL, password: PASSWORD, otp });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(401);
    expect(replay.body.token).toBeUndefined();
  });

  it("refuses a code already used on /login when it is replayed against /login/2fa", async () => {
    const otp = currentOtp();
    await post(login, { email: EMAIL, password: PASSWORD, otp });

    const challenge = await post(login, { email: EMAIL, password: PASSWORD });
    const replay = await post(verifyLogin2FA, { otp }, { pending2fa: challenge.cookies.pending2fa });

    expect(replay.statusCode).toBe(401);
    expect(replay.body.token).toBeUndefined();
  });

  it("lets only one of several concurrent logins with the same code through", async () => {
    const otp = currentOtp();

    const results = await Promise.all(
      Array.from({ length: 4 }, () => post(login, { email: EMAIL, password: PASSWORD, otp }))
    );

    expect(results.filter((res) => res.statusCode === 200)).toHaveLength(1);
  });
});
