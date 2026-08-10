jest.mock("../../model/sponsor", () => ({
  find: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

const Sponsor = require("../../model/sponsor");
const {
  getSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
} = require("../../controller/sponsor");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("Sponsor controller ownership", () => {
  const userId = "64b7f1f1f1f1f1f1f1f1f1f1";
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: { id: userId },
      params: { id: "sponsor-id" },
      body: { companyName: "Acme" },
    };
    res = createResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("lists sponsors for the JWT user id", async () => {
    const sort = jest.fn().mockResolvedValue([{ companyName: "Acme" }]);
    Sponsor.find.mockReturnValue({ sort });

    await getSponsors(req, res, next);

    expect(Sponsor.find).toHaveBeenCalledWith({ creatorId: userId });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ companyName: "Acme" }],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("creates sponsors for the JWT user id", async () => {
    Sponsor.create.mockResolvedValue({ companyName: "Acme", creatorId: userId });

    await createSponsor(req, res, next);

    expect(Sponsor.create).toHaveBeenCalledWith({ companyName: "Acme", creatorId: userId });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { companyName: "Acme", creatorId: userId },
    });
  });

  it("updates sponsors using the JWT user id filter", async () => {
    Sponsor.findOneAndUpdate.mockResolvedValue({ companyName: "Acme" });

    await updateSponsor(req, res, next);

    expect(Sponsor.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "sponsor-id", creatorId: userId },
      { companyName: "Acme" },
      { new: true, runValidators: true }
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { companyName: "Acme" },
    });
  });

  it("deletes sponsors using the JWT user id filter", async () => {
    Sponsor.findOneAndDelete.mockResolvedValue({ _id: "sponsor-id" });

    await deleteSponsor(req, res, next);

    expect(Sponsor.findOneAndDelete).toHaveBeenCalledWith({
      _id: "sponsor-id",
      creatorId: userId,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Sponsor deleted" });
  });
});
