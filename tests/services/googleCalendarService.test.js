jest.mock("../../model/user", () => ({
  findByIdAndUpdate: jest.fn(),
}));

const GoogleCalendarService = require("../../services/googleCalendarService");

describe("GoogleCalendarService OAuth state", () => {
  const originalEnv = { ...process.env };
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "http://localhost:3000/api/meetings/google/callback";
    process.env.GOOGLE_OAUTH_STATE_SECRET = "test-oauth-state-secret";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("generates a state that validates back to the initiating user", () => {
    const state = GoogleCalendarService.createOAuthState(userId);

    expect(state).not.toBe(userId);
    expect(GoogleCalendarService.verifyOAuthState(state)).toBe(userId);
  });

  it("rejects a state whose payload has been tampered with", () => {
    const state = GoogleCalendarService.createOAuthState(userId);
    const [encodedPayload, signature] = state.split(".");
    const tamperedPayload = Buffer.from(`${"507f1f77bcf86cd799439012"}.${Date.now()}.attacker`).toString("base64url");

    expect(GoogleCalendarService.verifyOAuthState(`${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("rejects expired state values", () => {
    const expiredTimestamp = Date.now() - 11 * 60 * 1000;
    const nonce = "nonce";
    const payload = `${userId}.${expiredTimestamp}.${nonce}`;
    const crypto = require("crypto");
    const signature = crypto
      .createHmac("sha256", process.env.GOOGLE_OAUTH_STATE_SECRET)
      .update(payload)
      .digest("hex");
    const state = `${Buffer.from(payload).toString("base64url")}.${signature}`;

    expect(GoogleCalendarService.verifyOAuthState(state)).toBeNull();
  });

  it("rejects unsigned or malformed state values", () => {
    expect(GoogleCalendarService.verifyOAuthState("507f1f77bcf86cd799439011")).toBeNull();
    expect(GoogleCalendarService.verifyOAuthState("not-a-valid-state.bad-signature")).toBeNull();
  });
});
