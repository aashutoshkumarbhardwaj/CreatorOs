jest.mock("../../model/scheduledContent", () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
}));

const ScheduledContent = require("../../model/scheduledContent");
const { listScheduledContent } = require("../../controller/contentController");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function mockFindChain(results) {
  const lean = jest.fn().mockResolvedValue(results);
  const limit = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ limit });
  ScheduledContent.find.mockReturnValue({ sort });
  return { sort, limit, lean };
}

function mockFindOneChain(result) {
  const lean = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ lean });
  ScheduledContent.findOne.mockReturnValue({ select });
  return { select, lean };
}

describe("Scheduled content listing", () => {
  const userId = "64b7f1f1f1f1f1f1f1f1f1f1";
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: { id: userId },
      query: {},
    };
    res = createResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("returns a bounded first page with pagination metadata", async () => {
    const items = Array.from({ length: 21 }, (_, index) => ({
      _id: `64b7f1f1f1f1f1f1f1f1f1${String(index).padStart(2, "0")}`.slice(0, 24),
      caption: `Post ${index}`,
    }));
    const { sort, limit } = mockFindChain(items);

    await listScheduledContent(req, res, next);

    expect(ScheduledContent.find).toHaveBeenCalledWith({ userId });
    expect(sort).toHaveBeenCalledWith({ scheduledAt: -1, _id: -1 });
    expect(limit).toHaveBeenCalledWith(21);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      items: items.slice(0, 20),
      pagination: {
        limit: 20,
        hasMore: true,
        nextCursor: items[19]._id,
      },
    });
  });

  it("rejects an invalid status filter", async () => {
    req.query.status = "draft";

    await listScheduledContent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Invalid status filter" });
    expect(ScheduledContent.find).not.toHaveBeenCalled();
  });

  it("rejects a malformed cursor", async () => {
    req.query.cursor = "bad-cursor";

    await listScheduledContent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Invalid cursor" });
    expect(ScheduledContent.find).not.toHaveBeenCalled();
  });

  it("continues from a valid cursor in scheduledAt order", async () => {
    const cursor = "64b7f1f1f1f1f1f1f1f1f1f1";
    const scheduledAt = new Date("2026-08-01T10:00:00.000Z");
    req.query = { cursor, status: "scheduled", limit: "5" };
    mockFindOneChain({ _id: cursor, scheduledAt });
    const { limit } = mockFindChain([]);

    await listScheduledContent(req, res, next);

    expect(ScheduledContent.findOne).toHaveBeenCalledWith({ _id: cursor, userId });
    expect(ScheduledContent.find).toHaveBeenCalledWith({
      userId,
      status: "scheduled",
      $or: [
        { scheduledAt: { $lt: scheduledAt } },
        { scheduledAt, _id: { $lt: cursor } },
      ],
    });
    expect(limit).toHaveBeenCalledWith(6);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      items: [],
      pagination: {
        limit: 5,
        hasMore: false,
        nextCursor: null,
      },
    });
  });
});
