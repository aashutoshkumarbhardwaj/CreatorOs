jest.mock("../../model/invite", () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock("../../model/user", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../utils/email", () => ({
  sendInvitationEmail: jest.fn(),
}));

const Invite = require("../../model/invite");
const User = require("../../model/user");
const { sendInvitationEmail } = require("../../utils/email");
const { sendCollaboratorInvite } = require("../../controller/collaborationController");

function createQuery(result) {
  return {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    render: jest.fn(),
  };
}

describe("sendCollaboratorInvite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockReturnValue(createQuery({ name: "Creator", email: "creator@example.com" }));
    Invite.find.mockReturnValue(createQuery([]));
  });

  it("does not create or send a duplicate pending invite", async () => {
    Invite.findOne.mockResolvedValue({ _id: "invite-id", status: "pending" });
    const req = {
      user: { id: "user-id" },
      protocol: "https",
      get: jest.fn().mockReturnValue("creatoros.test"),
      body: {
        email: "Guest@Example.com",
        projectName: " Launch ",
      },
    };
    const res = createResponse();

    await sendCollaboratorInvite(req, res, jest.fn());

    expect(Invite.findOne).toHaveBeenCalledWith({
      inviter: "user-id",
      email: "guest@example.com",
      projectName: "Launch",
      status: "pending",
    });
    expect(Invite.create).not.toHaveBeenCalled();
    expect(sendInvitationEmail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.render).toHaveBeenCalledWith("creator-crm", expect.objectContaining({
      success: null,
      error: "An invite is already pending for guest@example.com.",
    }));
  });
});
