const express = require("express");
const request = require("supertest");

jest.mock("passport", () => ({
  use: jest.fn(),
  authenticate: jest.fn(() => (req, res, next) => next()),
}));

jest.mock("../../controller/auth", () => ({
  signup: jest.fn(),
  login: jest.fn(),
  handleGoogleCallback: jest.fn(),
  verifyLogin2FA: jest.fn(),
  loginAsContributor: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationEmail: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
}));

jest.mock("../../middleware/validators", () => ({
  signupValidator: (req, res, next) => next(),
  loginValidator: (req, res, next) => next(),
  resendVerificationValidator: (req, res, next) => next(),
}));

jest.mock("../../middleware/rateLimiters", () => ({
  loginLimiter: (req, res, next) => next(),
  signupLimiter: (req, res, next) => next(),
  emailVerificationLimiter: (req, res, next) => next(),
  forgotPasswordLimiter: (req, res, next) => next(),
  resetPasswordLimiter: (req, res, next) => next(),
}));

jest.mock("../../connect", () => jest.fn());
jest.mock("../../model/passwordResetToken", () => ({
  findOne: jest.fn().mockResolvedValue({ token: "abc123", used: false }),
}));
jest.mock("../../model/user", () => ({
  findOne: jest.fn().mockResolvedValue(null),
}));

const authRoutes = require("../../routes/auth");

function createApp() {
  const app = express();
  app.set("view engine", "ejs");
  app.response.render = function render(view, locals) {
    return this.status(200).json({ view, locals });
  };
  app.use(authRoutes);
  return app;
}

describe("auth routes", () => {
  it("renders reset password once with the query token", async () => {
    const res = await request(createApp()).get("/reset-password?token=abc123");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      view: "reset-password",
      locals: { token: "abc123", error: null, formHidden: false },
    });
  });
});
