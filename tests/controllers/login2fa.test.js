process.env.USE_MOCK_DB = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-2fa";
process.env.NODE_ENV = "test";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const User = require("../../model/user");
const { login, verifyLogin2FA } = require("../../controller/auth");
const { generateHotp, decodeBase32 } = require("../../utils/totp");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.set("view engine", "ejs");
  app.set("views", require("path").join(__dirname, "../../view"));
  app.post("/login", login);
  app.post("/login/2fa", verifyLogin2FA);
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  });
  return app;
}

describe("login 2FA enforcement (#976)", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const password = "SecretPass123!";
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({
      name: "2FA User",
      email: "twofa@example.com",
      password: passwordHash,
      isVerified: true,
      authProvider: "local",
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    });
  });

  function currentOtp() {
    const counter = Math.floor(Date.now() / 1000 / 30);
    return generateHotp(decodeBase32(secret), counter);
  }

  it("does not issue a session cookie when 2FA is enabled and otp is missing", async () => {
    const res = await request(app)
      .post("/login")
      .set("Accept", "application/json")
      .send({ email: "twofa@example.com", password });

    expect(res.statusCode).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeUndefined();

    const setCookie = res.headers["set-cookie"] || [];
    expect(setCookie.some((c) => c.startsWith("token="))).toBe(false);
    expect(setCookie.some((c) => c.startsWith("pending2fa="))).toBe(true);
  });

  it("completes login with a valid otp via /login/2fa", async () => {
    const challenge = await request(app)
      .post("/login")
      .set("Accept", "application/json")
      .send({ email: "twofa@example.com", password });

    const pendingCookie = (challenge.headers["set-cookie"] || []).find((c) =>
      c.startsWith("pending2fa=")
    );
    expect(pendingCookie).toBeTruthy();

    const res = await request(app)
      .post("/login/2fa")
      .set("Cookie", [pendingCookie.split(";")[0]])
      .set("Accept", "application/json")
      .send({ otp: currentOtp() });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    const setCookie = res.headers["set-cookie"] || [];
    expect(setCookie.some((c) => c.startsWith("token="))).toBe(true);
  });

  it("rejects an invalid otp", async () => {
    const challenge = await request(app)
      .post("/login")
      .set("Accept", "application/json")
      .send({ email: "twofa@example.com", password });

    const pendingCookie = (challenge.headers["set-cookie"] || []).find((c) =>
      c.startsWith("pending2fa=")
    );

    const res = await request(app)
      .post("/login/2fa")
      .set("Cookie", [pendingCookie.split(";")[0]])
      .set("Accept", "application/json")
      .send({ otp: "000000" });

    expect(res.statusCode).toBe(401);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body.token).toBeUndefined();
  });
});
