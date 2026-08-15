const { buildUnifiedAnalyticsData } = require("../../utils/analyticsHelper");
const { getAnalyticsSummary, getLiveCount, exportAnalyticsCsv } = require("../../controller/analytics");

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status: jest.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(function (data) {
      res.body = data;
      return res;
    }),
    setHeader: jest.fn(function (key, val) {
      res.headers[key] = val;
    }),
    send: jest.fn(function (content) {
      res.body = content;
      return res;
    }),
  };
  return res;
}

describe("Unified Analytics Dashboard Aggregation & Handlers (#963)", () => {
  const mockUserId = "64b7f1f1f1f1f1f1f1f1f1f1";

  it("buildUnifiedAnalyticsData returns comprehensive data across 6 CreatorOS modules", async () => {
    const data = await buildUnifiedAnalyticsData(mockUserId, { range: "30" });

    expect(data).toHaveProperty("selectedRange", "30");
    expect(data).toHaveProperty("summaryCards");
    expect(data.summaryCards).toHaveProperty("traffic");
    expect(data.summaryCards).toHaveProperty("clicks");
    expect(data.summaryCards).toHaveProperty("views");
    expect(data.summaryCards).toHaveProperty("downloads");
    expect(data.summaryCards).toHaveProperty("revenue");

    expect(data).toHaveProperty("moduleMetrics");
    expect(data.moduleMetrics).toHaveProperty("smartBio");
    expect(data.moduleMetrics).toHaveProperty("urlShortener");
    expect(data.moduleMetrics).toHaveProperty("fileUpload");
    expect(data.moduleMetrics).toHaveProperty("creatorCrm");
    expect(data.moduleMetrics).toHaveProperty("dmAutomation");
    expect(data.moduleMetrics).toHaveProperty("contentOs");

    expect(data).toHaveProperty("heatmap");
    expect(data.heatmap.matrix.length).toBe(7);
    expect(data.heatmap.matrix[0].length).toBe(24);

    expect(data).toHaveProperty("charts");
    expect(Array.isArray(data.charts.labels)).toBe(true);

    expect(data).toHaveProperty("topContent");
    expect(Array.isArray(data.topContent)).toBe(true);
  });

  it("buildUnifiedAnalyticsData handles custom date range filters (7, 90, all)", async () => {
    const data7 = await buildUnifiedAnalyticsData(mockUserId, { range: "7" });
    expect(data7.rangeDays).toBe(7);
    expect(data7.charts.labels.length).toBe(7);

    const data90 = await buildUnifiedAnalyticsData(mockUserId, { range: "90" });
    expect(data90.rangeDays).toBe(90);
    expect(data90.charts.labels.length).toBe(90);

    const dataAll = await buildUnifiedAnalyticsData(mockUserId, { range: "all" });
    expect(dataAll.rangeDays).toBe(365);
  });

  it("getAnalyticsSummary endpoint returns JSON summary", async () => {
    const req = { user: { id: mockUserId }, query: { range: "30" } };
    const res = createMockRes();

    await getAnalyticsSummary(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("summaryCards");
  });

  it("getLiveCount endpoint returns live metrics counters", async () => {
    const req = { user: { id: mockUserId } };
    const res = createMockRes();

    await getLiveCount(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("totalClicks");
    expect(res.body).toHaveProperty("totalViews");
    expect(res.body).toHaveProperty("totalDownloads");
    expect(res.body).toHaveProperty("totalRevenue");
  });

  it("exportAnalyticsCsv endpoint returns text/csv output attachment", async () => {
    const req = { user: { id: mockUserId }, query: { range: "30" } };
    const res = createMockRes();

    await exportAnalyticsCsv(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("attachment; filename=")
    );
    expect(res.send).toHaveBeenCalled();
    expect(res.body).toContain("CreatorOS Unified Analytics Report");
    expect(res.body).toContain("Total Traffic");
    expect(res.body).toContain("URL Shortener");
  });
});
