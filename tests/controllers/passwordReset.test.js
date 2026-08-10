jest.mock("../../connect", () => jest.fn().mockResolvedValue());
jest.mock("../../model/user", () => ({
  findById: jest.fn(),
}));
jest.mock("../../model/passwordResetToken", () => ({
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
}));

const bcrypt = require("bcryptjs");
const User = require("../../model/user");
const PasswordResetToken = require("../../model/passwordResetToken");
const { resetPassword } = require("../../controller/auth");

describe("Password reset", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {
        token: "reset-token",
        newPassword: "NewPassword123!",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("rejects short reset passwords without consuming the token", async () => {
    req.body.newPassword = "short";

    await resetPassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Password must be at least 8 characters",
    });
    expect(PasswordResetToken.findOneAndUpdate).not.toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("resets the password when the token and new password are valid", async () => {
    const user = {
      email: "user@example.com",
      save: jest.fn().mockResolvedValue(),
    };
    PasswordResetToken.findOneAndUpdate.mockResolvedValue({ userId: "user-id" });
    User.findById.mockResolvedValue(user);
    jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed-password");

    await resetPassword(req, res, next);

    expect(PasswordResetToken.findOneAndUpdate).toHaveBeenCalledWith(
      { token: "reset-token", used: false, expiresAt: { $gt: expect.any(Date) } },
      { $set: { used: true, usedAt: expect.any(Date) } },
      { new: true }
    );
    expect(user.password).toBe("hashed-password");
    expect(user.passwordChangedAt).toBeInstanceOf(Date);
    expect(user.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
