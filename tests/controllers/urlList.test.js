jest.mock("../../model/url", () => ({
  listForUser: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const Url = require("../../model/url");
const { handleListUserLinks } = require("../../controller/url");

function createResponse() {
  return {
    json: jest.fn(),
  };
}

function createRequest(query = {}) {
  return {
    protocol: "https",
    query,
    user: { id: "user-id" },
    get: jest.fn().mockReturnValue("creatoros.test"),
  };
}

describe("URL list API pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the first page with pagination metadata", async () => {
    const entries = Array.from({ length: 21 }, (_, index) => ({
      _id: { toString: () => `cursor-${index}` },
      shortId: `link-${index}`,
      redirectUrl: `https://example.com/${index}`,
      totalClicks: index,
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
    }));
    Url.listForUser.mockResolvedValue(entries);
    const res = createResponse();

    await handleListUserLinks(createRequest(), res);

    expect(Url.listForUser).toHaveBeenCalledWith("user-id", { limit: 21, cursor: null });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      links: expect.arrayContaining([
        expect.objectContaining({ shortId: "link-0" }),
      ]),
      pagination: {
        limit: 20,
        hasMore: true,
        nextCursor: "cursor-19",
      },
    }));
    expect(res.json.mock.calls[0][0].links).toHaveLength(20);
  });

  it("clamps large limits to the maximum page size", async () => {
    Url.listForUser.mockResolvedValue([]);
    const res = createResponse();

    await handleListUserLinks(createRequest({ limit: "500", cursor: "cursor-1" }), res);

    expect(Url.listForUser).toHaveBeenCalledWith("user-id", { limit: 101, cursor: "cursor-1" });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      pagination: {
        limit: 100,
        hasMore: false,
        nextCursor: null,
      },
    }));
  });
});
