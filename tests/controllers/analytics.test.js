jest.mock("../../model/creator", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock("../../model/analyticsSnapshot", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock("../../model/engagementHistory", () => ({
  find: jest.fn(),
}));
jest.mock("../../utils/instagramApi", () => ({
  fetchInstagramAnalytics: jest.fn(),
}));

const Creator = require("../../model/creator");
const {
  getSnapshots,
  triggerRefresh,
} = require("../../controller/analytics");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("Analytics controller creatorId validation", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      params: { creatorId: "not-an-object-id" },
      user: { id: "64b7f1f1f1f1f1f1f1f1f1f1" },
    };
    res = createResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("does not query Creator ownership for malformed snapshot ids", async () => {
    await getSnapshots(req, res, next);

    expect(Creator.findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized access to creator analytics",
    });
  });

  it("returns 400 before refreshing a malformed creator id", async () => {
    await triggerRefresh(req, res, next);

    expect(Creator.findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid creatorId",
    });
  });
});
