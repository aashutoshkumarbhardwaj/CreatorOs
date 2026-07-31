const express = require("express");
const request = require("supertest");

const mockResetPassword = jest.fn((req, res) => res.json({ success: true }));
const mockResetPasswordLimiter = jest.fn((req, res, next) => next());

jest.mock("passport", () => ({
  use: jest.fn(),
  authenticate: jest.fn(() => (req, res, next) => next()),
}));

jest.mock("../../controller/auth", () => ({
  signup: jest.fn(),
  login: jest.fn(),
  handleGoogleCallback: jest.fn(),
  loginAsContributor: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationEmail: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: mockResetPassword,
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
  resetPasswordLimiter: mockResetPasswordLimiter,
}));

jest.mock("../../connect", () => jest.fn());

const authRoutes = require("../../routes/auth");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(authRoutes);
  return app;
}

describe("reset password route limiter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs the reset password limiter before the controller", async () => {
    const res = await request(createApp())
      .post("/reset-password")
      .send({ token: "token", newPassword: "Password123!" });

    expect(res.statusCode).toBe(200);
    expect(mockResetPasswordLimiter).toHaveBeenCalled();
    expect(mockResetPassword).toHaveBeenCalled();
    expect(mockResetPasswordLimiter.mock.invocationCallOrder[0]).toBeLessThan(
      mockResetPassword.mock.invocationCallOrder[0]
    );
  });
});
