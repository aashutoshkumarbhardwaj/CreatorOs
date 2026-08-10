jest.mock("../../model/invite", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../model/user", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../utils/dashboardHelper", () => ({
  getDashboardData: jest.fn().mockResolvedValue({}),
}));

const Invite = require("../../model/invite");
const User = require("../../model/user");
const { acceptInviteFromDashboard } = require("../../controller/collaborationController");

function createQuery(result) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

function createResponse() {
  return {
    render: jest.fn(),
  };
}

describe("acceptInviteFromDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports an email mismatch instead of already accepted", async () => {
    User.findById.mockReturnValue(createQuery({ email: "signedin@example.com", name: "Signed In" }));
    Invite.findOneAndUpdate.mockResolvedValue(null);
    Invite.findOne.mockResolvedValue({
      token: "invite-token",
      status: "pending",
      email: "recipient@example.com",
      expiresAt: new Date(Date.now() + 60 * 1000),
    });
    const req = {
      user: { id: "user-id", name: "Signed In" },
      body: { inviteToken: "invite-token" },
    };
    const res = createResponse();

    await acceptInviteFromDashboard(req, res, jest.fn());

    expect(Invite.findOne).toHaveBeenCalledWith({ token: "invite-token" });
    expect(res.render).toHaveBeenCalledWith("dashboard", expect.objectContaining({
      inviteAcceptError: "This invitation was sent to a different email address.",
      inviteAcceptMessage: null,
    }));
  });
});
