jest.mock("../../connect", () => jest.fn().mockResolvedValue());
jest.mock("../../model/user", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../utils/loginAttemptManager", () => ({
  checkIfLoginLocked: jest.fn().mockResolvedValue(false),
  recordFailedLoginAttempt: jest.fn().mockResolvedValue(),
  clearLoginAttempts: jest.fn().mockResolvedValue(),
  getRemainingLoginLockoutTime: jest.fn().mockResolvedValue(0),
  checkIfResetLocked: jest.fn().mockResolvedValue(false),
  recordFailedResetAttempt: jest.fn().mockResolvedValue(),
  clearResetAttempts: jest.fn().mockResolvedValue(),
  getRemainingResetLockoutTime: jest.fn().mockResolvedValue(0),
}));
jest.mock("../../utils/requestType", () => ({
  wantsHtml: jest.fn().mockReturnValue(false),
}));

const bcrypt = require("bcryptjs");
const User = require("../../model/user");
const {
  recordFailedLoginAttempt,
} = require("../../utils/loginAttemptManager");
const { login } = require("../../controller/auth");

describe("Google-only password login (#979)", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {
        email: "googleonly@example.com",
        password: "AnyPassword123!",
      },
      headers: { accept: "application/json" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn(),
      render: jest.fn(),
      cookie: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    require("../../utils/requestType").wantsHtml.mockReturnValue(false);
    require("../../utils/loginAttemptManager").checkIfLoginLocked.mockResolvedValue(false);
  });

  it("returns generic 401 instead of 500 when account has no password hash", async () => {
    User.findOne.mockResolvedValue({
      email: "googleonly@example.com",
      authProvider: "google",
      password: undefined,
      isVerified: true,
    });

    const compareSpy = jest.spyOn(bcrypt, "compare");

    await login(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid email or password",
    });
    expect(recordFailedLoginAttempt).toHaveBeenCalledWith("googleonly@example.com");
    expect(compareSpy).toHaveBeenCalled();
    const [, hashArg] = compareSpy.mock.calls[0];
    expect(hashArg).toBe("$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUU");
    compareSpy.mockRestore();
  });
});
