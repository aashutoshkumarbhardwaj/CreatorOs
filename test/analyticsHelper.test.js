jest.mock("../model/url", () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../model/bioProfile", () => ({
  findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
}));
jest.mock("../model/vaultFile", () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../model/upload", () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../model/crmDeal", () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../model/crmInvoice", () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../model/dmTrigger", () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../model/contentOs", () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../model/post", () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../model/creator", () => ({
  findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
  findById: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
}));
jest.mock("../model/analyticsSnapshot", () => ({
  findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
}));

const { buildUnifiedAnalyticsData } = require("../utils/analyticsHelper");
const Url = require("../model/url");
const BioProfile = require("../model/bioProfile");
const VaultFile = require("../model/vaultFile");
const Upload = require("../model/upload");
const CrmDeal = require("../model/crmDeal");
const CrmInvoice = require("../model/crmInvoice");
const DmTrigger = require("../model/dmTrigger");
const ContentOs = require("../model/contentOs");
const Post = require("../model/post");
const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");

const queryResult = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
});

const resetMocksToEmpty = () => {
  Url.find.mockImplementation(() => queryResult([]));
  BioProfile.findOne.mockImplementation(() => queryResult(null));
  VaultFile.find.mockImplementation(() => queryResult([]));
  Upload.find.mockImplementation(() => queryResult([]));
  CrmDeal.find.mockImplementation(() => queryResult([]));
  CrmInvoice.find.mockImplementation(() => queryResult([]));
  DmTrigger.find.mockImplementation(() => queryResult([]));
  ContentOs.find.mockImplementation(() => queryResult([]));
  Post.find.mockImplementation(() => queryResult([]));
  Creator.findOne.mockImplementation(() => queryResult(null));
  Creator.findById.mockImplementation(() => queryResult(null));
  AnalyticsSnapshot.findOne.mockImplementation(() => queryResult(null));
};

describe("buildUnifiedAnalyticsData", () => {
  beforeEach(() => {
    resetMocksToEmpty();
  });

  test("does not fabricate metrics when analytics data is unavailable", async () => {
    const analytics = await buildUnifiedAnalyticsData("user-1");

    expect(analytics.summaryCards).toMatchObject({
      traffic: { value: 0, growth: 0 },
      clicks: { value: 0, growth: 0 },
      views: { value: 0, growth: 0 },
      downloads: { value: 0, growth: 0 },
      followers: { value: 0, growth: 0 },
      conversions: { value: 0, growth: 0 },
      revenue: { value: 0, growth: 0 },
      engagementRate: { value: 0, growth: 0 },
    });

    expect(analytics.moduleSplit.data).toEqual([0, 0, 0, 0, 0, 0]);
    expect(analytics.charts.followers).toEqual(Array(30).fill(0));
    expect(analytics.charts.downloads).toEqual(Array(30).fill(0));
    expect(analytics.charts.revenue).toEqual(Array(30).fill(0));
    expect(analytics.charts.engagement).toEqual(Array(30).fill(0));
    expect(analytics.heatmap.matrix.flat().every((value) => value === 0)).toBe(true);
  });

  test("preserves metrics that are actually present in storage", async () => {
    const visitDate = new Date();

    Url.find.mockImplementation(() => queryResult([
      {
        totalClicks: 5,
        visitHistory: [{
          timestamp: visitDate,
          device: "desktop",
          browser: "Chrome",
          country: "India",
        }],
      },
    ]));
    BioProfile.findOne.mockImplementation(() => queryResult({
      stats: { views: 12, clicks: 3 },
      links: [{ url: "https://example.com" }],
      handle: "creator",
    }));
    Post.find.mockImplementation(() => queryResult([
      { views: 100, likes: 10, comments: 5, createdAt: visitDate },
    ]));
    Creator.findOne.mockImplementation(() => queryResult({
      _id: "creator-1",
      followersCount: 500,
    }));
    AnalyticsSnapshot.findOne.mockImplementation(() => queryResult({
      followers: 600,
      createdAt: visitDate,
    }));
    VaultFile.find.mockImplementation(() => queryResult([
      { size: 1024, createdAt: visitDate },
    ]));

    const analytics = await buildUnifiedAnalyticsData("user-1");

    expect(analytics.summaryCards.traffic.value).toBe(117);
    expect(analytics.summaryCards.clicks.value).toBe(8);
    expect(analytics.summaryCards.views.value).toBe(112);
    expect(analytics.summaryCards.followers.value).toBe(600);
    expect(analytics.summaryCards.engagementRate.value).toBe(15);
    expect(analytics.summaryCards.uploads.value).toBe(1);
    expect(analytics.charts.clicks.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(analytics.charts.views.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(analytics.heatmap.matrix.flat().reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
  });
});
