process.env.USE_MOCK_DB = "true";

const User = require("../../model/user");
const { consumeTotp } = require("../../utils/twoFactor");
const { generateHotp, decodeBase32 } = require("../../utils/totp");

describe("consumeTotp (single-use TOTP)", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const now = 1_111_111_111_000;
  const counter = Math.floor(now / 1000 / 30);
  const codeFor = (step) => generateHotp(decodeBase32(secret), step);
  let user;

  beforeEach(async () => {
    await User.deleteMany({ email: "replay@example.com" });
    user = await User.create({
      name: "Replay Test",
      email: "replay@example.com",
      password: "hash",
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    });
  });

  it("accepts a valid code the first time", async () => {
    expect(await consumeTotp(User, user, codeFor(counter), { now })).toBe(true);
  });

  it("rejects the same code the second time, even though it is still inside its window", async () => {
    const code = codeFor(counter);

    expect(await consumeTotp(User, user, code, { now })).toBe(true);
    expect(await consumeTotp(User, user, code, { now })).toBe(false);
    expect(await consumeTotp(User, user, code, { now: now + 20_000 })).toBe(false);
  });

  it("accepts the next time-step's code after one has been used", async () => {
    expect(await consumeTotp(User, user, codeFor(counter), { now })).toBe(true);
    expect(await consumeTotp(User, user, codeFor(counter + 1), { now })).toBe(true);
  });

  it("never accepts a code from an earlier step than the last one used", async () => {
    expect(await consumeTotp(User, user, codeFor(counter + 1), { now })).toBe(true);
    expect(await consumeTotp(User, user, codeFor(counter), { now })).toBe(false);
    expect(await consumeTotp(User, user, codeFor(counter - 1), { now })).toBe(false);
  });

  it("lets exactly one of several concurrent requests with the same code succeed", async () => {
    const code = codeFor(counter);

    const results = await Promise.all(Array.from({ length: 6 }, () => consumeTotp(User, user, code, { now })));

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("does not burn the step for an invalid code", async () => {
    expect(await consumeTotp(User, user, "000000", { now })).toBe(false);
    expect(await consumeTotp(User, user, codeFor(counter), { now })).toBe(true);
  });

  it("rejects users without a secret", async () => {
    expect(await consumeTotp(User, { _id: user._id, twoFactorSecret: null }, codeFor(counter), { now })).toBe(false);
    expect(await consumeTotp(User, null, codeFor(counter), { now })).toBe(false);
  });
});
