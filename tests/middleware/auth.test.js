const jwt = require("jsonwebtoken");
const protect = require("../../middleware/auth");
const { requireAdmin, preventContributorWrites } = require("../../middleware/auth");
const User = require("../../model/user");
const ContributorSession = require("../../model/contributorSession");
const { wantsHtml } = require("../../utils/requestType");
const { isEmailTransportConfigured } = require("../../utils/email");

jest.mock("jsonwebtoken");
jest.mock("../../connect", () => jest.fn());
jest.mock("../../model/user");
jest.mock("../../model/contributorSession");
jest.mock("../../utils/requestType", () => ({
  wantsHtml: jest.fn().mockReturnValue(false)
}));
jest.mock("../../utils/email", () => ({
  isEmailTransportConfigured: jest.fn().mockReturnValue(true)
}));

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {},
      get: jest.fn()
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("protect", () => {
    it("should return 401 if no token provided", async () => {
      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
        error: "Authentication required"
      });
    });

    it("should redirect to login if wantsHtml is true and no token", async () => {
      wantsHtml.mockReturnValueOnce(true);
      await protect(req, res, next);
      expect(res.redirect).toHaveBeenCalledWith("/login");
    });

    it("should allow access with valid token", async () => {
      req.cookies.token = "valid_token";
      jwt.verify.mockReturnValue({ email: "test@example.com", role: "user" });
      User.findOne.mockResolvedValue({ email: "test@example.com", isVerified: true });

      await protect(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user.email).toBe("test@example.com");
    });

    it("should reject expired/malformed token", async () => {
      req.headers.authorization = "Bearer invalid_token";
      jwt.verify.mockImplementation(() => { throw new Error("Invalid token"); });

      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid or expired token",
        error: "Invalid or expired token"
      });
    });
    
    it("should reject unverified users", async () => {
      req.cookies.token = "valid_token";
      jwt.verify.mockReturnValue({ email: "unverified@example.com", role: "user" });
      User.findOne.mockResolvedValue({ email: "unverified@example.com", isVerified: false });
      
      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("/resend-verification"));
    });

    it("should handle guest_contributor role", async () => {
      req.cookies.token = "valid_token";
      jwt.verify.mockReturnValue({ id: "123", role: "guest_contributor" });
      ContributorSession.findOne.mockResolvedValue({ contributorId: "123" });

      await protect(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe("123");
    });

    it("should reject guest_contributor with invalid session", async () => {
      req.cookies.token = "valid_token";
      jwt.verify.mockReturnValue({ id: "123", role: "guest_contributor" });
      ContributorSession.findOne.mockResolvedValue(null);

      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should redirect if User not found", async () => {
      req.cookies.token = "valid_token";
      jwt.verify.mockReturnValue({ email: "test@example.com", role: "user" });
      User.findOne.mockResolvedValue(null);

      await protect(req, res, next);
      expect(res.redirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("requireAdmin", () => {
    it("should call next if user is admin", () => {
      req.user = { role: "admin" };
      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("should return 403 if user is not admin", () => {
      req.user = { role: "user" };
      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Admin access required",
        error: "Admin access required"
      });
    });
  });

  describe("preventContributorWrites", () => {
    it("should call next if user is admin or user", () => {
      req.user = { role: "user" };
      preventContributorWrites(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("should return 403 if user is contributor", () => {
      req.user = { role: "contributor" };
      preventContributorWrites(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
    
    it("should return 403 if user is guest_contributor", () => {
      req.user = { role: "guest_contributor" };
      preventContributorWrites(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
