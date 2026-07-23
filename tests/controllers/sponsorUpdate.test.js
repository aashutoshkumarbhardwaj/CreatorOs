jest.mock("../../model/sponsor", () => ({
  findOneAndUpdate: jest.fn(),
}));

const Sponsor = require("../../model/sponsor");
const { updateSponsor, buildSponsorUpdate } = require("../../controller/sponsor");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("sponsor update allowlist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("drops protected fields from update payloads", () => {
    expect(buildSponsorUpdate({
      companyName: "Acme",
      creatorId: "attacker-id",
      createdAt: "2026-01-01",
      status: "negotiating",
    })).toEqual({
      companyName: "Acme",
      status: "negotiating",
    });
  });

  it("updates only allowlisted fields", async () => {
    Sponsor.findOneAndUpdate.mockResolvedValue({ companyName: "Acme" });
    const req = {
      params: { id: "sponsor-id" },
      user: { _id: "user-id" },
      body: {
        companyName: "Acme",
        creatorId: "other-user",
        updatedAt: "2026-01-01",
      },
    };
    const res = createResponse();

    await updateSponsor(req, res, jest.fn());

    expect(Sponsor.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "sponsor-id", creatorId: "user-id" },
      { $set: { companyName: "Acme" } },
      { new: true, runValidators: true }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { companyName: "Acme" } });
  });

  it("rejects updates without editable fields", async () => {
    const req = {
      params: { id: "sponsor-id" },
      user: { _id: "user-id" },
      body: { creatorId: "other-user" },
    };
    const res = createResponse();

    await updateSponsor(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "No valid sponsor fields provided",
    });
    expect(Sponsor.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
