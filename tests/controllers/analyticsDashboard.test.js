const Creator = require("../../model/creator");
const AnalyticsSnapshot = require("../../model/analyticsSnapshot");
const EngagementHistory = require("../../model/engagementHistory");
const Post = require("../../model/post");

describe("Analytics Dashboard Mock Models & Auto-Seeding", () => {
  const originalEnv = process.env.USE_MOCK_DB;

  beforeAll(() => {
    process.env.USE_MOCK_DB = "true";
  });

  afterAll(() => {
    process.env.USE_MOCK_DB = originalEnv;
  });

  it("returns pre-seeded creator profile for default test user 000000000000000000000001", async () => {
    const creator = await Creator.findOne({ userId: "000000000000000000000001" }).lean();
    expect(creator).toBeDefined();
    expect(creator.username).toBe("test_creator");
    expect(creator.platform).toBe("instagram");
  });

  it("returns pre-seeded analytics snapshot for test creator", async () => {
    const snap = await AnalyticsSnapshot.findOne({ creatorId: "creator_test_001" }).lean();
    expect(snap).toBeDefined();
    expect(snap.followers).toBe(142500);
    expect(snap.engagementRate).toBe(5.42);
  });

  it("returns pre-seeded 30-day engagement history for test creator", async () => {
    const history = await EngagementHistory.find({ creatorId: "creator_test_001" }).lean();
    expect(history).toBeDefined();
    expect(history.length).toBeGreaterThanOrEqual(30);
  });

  it("returns pre-seeded top posts for test creator", async () => {
    const posts = await Post.find({ creatorId: "creator_test_001" }).sort({ views: -1 }).limit(5).lean();
    expect(posts).toBeDefined();
    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0].caption).toBeDefined();
  });

  it("auto-seeds a demo creator and analytics when a new userId is queried in mock DB mode", async () => {
    const newUserId = "999999999999999999999999";
    const creator = await Creator.findOne({ userId: newUserId }).lean();
    expect(creator).toBeDefined();
    expect(creator.userId).toBe(newUserId);

    const snap = await AnalyticsSnapshot.findOne({ creatorId: creator._id }).lean();
    expect(snap).toBeDefined();
    expect(snap.followers).toBe(142500);
  });
});
