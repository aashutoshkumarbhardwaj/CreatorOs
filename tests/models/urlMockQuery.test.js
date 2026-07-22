process.env.USE_MOCK_DB = "true";

const Url = require("../../model/url");

describe("Mock Url query chaining", () => {
  const userId = "64b7f1f1f1f1f1f1f1f1f1f1";

  beforeEach(async () => {
    await Url.deleteMany({ userId });
  });

  it("supports Mongoose-style sort, limit, and lean chaining", async () => {
    await Url.create({
      userId,
      shortId: "old",
      redirectUrl: "https://example.com/old",
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    });
    await Url.create({
      userId,
      shortId: "middle",
      redirectUrl: "https://example.com/middle",
      createdAt: new Date("2026-07-21T00:00:00.000Z"),
    });
    await Url.create({
      userId,
      shortId: "new",
      redirectUrl: "https://example.com/new",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
    });

    const results = await Url.find({ userId })
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    expect(results.map((url) => url.shortId)).toEqual(["new", "middle"]);
  });

  it("supports awaiting a sorted query without lean", async () => {
    await Url.create({
      userId,
      shortId: "first",
      redirectUrl: "https://example.com/first",
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    });

    const results = await Url.find({ userId }).sort({ createdAt: -1 });

    expect(results).toHaveLength(1);
    expect(results[0].shortId).toBe("first");
  });
});
