const { generateState, validateState } = require("../../utils/oauthState");

describe("OAuth state token", () => {
  const userId = "60d5ecb8b5c9c22b1c8e4444";

  it("round-trips a valid state token", () => {
    const state = generateState(userId);
    expect(validateState(state)).toBe(userId);
  });

  it("produces unique tokens on each call", () => {
    const a = generateState(userId);
    const b = generateState(userId);
    expect(a).not.toBe(b);
  });

  it("rejects a tampered payload", () => {
    const state = generateState(userId);
    const [encoded, sig] = state.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ uid: "attacker_id", nonce: "abc", exp: Date.now() + 600000 })
    ).toString("base64url");
    expect(validateState(`${tampered}.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const state = generateState(userId);
    const [encoded] = state.split(".");
    expect(validateState(`${encoded}.badsignature`)).toBeNull();
  });

  it("rejects a shorter signature without throwing RangeError", () => {
    const state = generateState(userId);
    const [encoded] = state.split(".");
    expect(validateState(`${encoded}.short`)).toBeNull();
  });

  it("rejects a longer signature without throwing RangeError", () => {
    const state = generateState(userId);
    const [encoded] = state.split(".");
    expect(validateState(`${encoded}.anextremelylongtamperedsignaturethatismuchlongerthanexpected`)).toBeNull();
  });

  it("rejects an invalid signature of the exact same length", () => {
    const state = generateState(userId);
    const [encoded, sig] = state.split(".");
    const corruptedSig = "x".repeat(sig.length);
    expect(validateState(`${encoded}.${corruptedSig}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const origNow = Date.now;
    const state = generateState(userId);
    Date.now = () => origNow() + 11 * 60 * 1000;
    expect(validateState(state)).toBeNull();
    Date.now = origNow;
  });

  it("rejects null, undefined, and empty string", () => {
    expect(validateState(null)).toBeNull();
    expect(validateState(undefined)).toBeNull();
    expect(validateState("")).toBeNull();
  });

  it("rejects a raw userId (no signature)", () => {
    expect(validateState(userId)).toBeNull();
  });
});
