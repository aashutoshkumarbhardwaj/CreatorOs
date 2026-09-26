const {
  computeHealthScore,
  detectMetricAnomaly,
  calculateCohortDecay,
} = require("../services/analyticsAggregationEngine");

describe("Analytics Aggregation & Cohort Engine Unit Tests", () => {
  describe("computeHealthScore", () => {
    it("should compute weighted 0-100 score across views, engagement, revenue, and bio clicks", () => {
      // Perfect metrics
      const perfectScore = computeHealthScore({
        totalViews: 50000,
        engagementRatePercent: 8.0,
        grossRevenue: 2000,
        bioClicks: 1000,
      });
      expect(perfectScore).toBe(100.0);

      // Mid-level metrics
      const midScore = computeHealthScore({
        totalViews: 25000, // 50% * 0.30 = 15
        engagementRatePercent: 4.0, // 50% * 0.35 = 17.5
        grossRevenue: 1000, // 50% * 0.20 = 10
        bioClicks: 500, // 50% * 0.15 = 7.5
      });
      expect(midScore).toBe(50.0);
    });
  });

  describe("detectMetricAnomaly", () => {
    it("should flag anomaly when drop exceeds 35% threshold", () => {
      const result = detectMetricAnomaly(5000, 10000, "YouTube Views");
      expect(result.isAnomaly).toBe(true);
      expect(result.dropPercent).toBe(50.0);
      expect(result.severity).toBe("warning");
      expect(result.reason).toContain("unexpected drop of 50%");
    });

    it("should not flag anomaly when variation is within safe bounds", () => {
      const result = detectMetricAnomaly(9000, 10000, "YouTube Views");
      expect(result.isAnomaly).toBe(false);
      expect(result.dropPercent).toBe(10.0);
    });
  });

  describe("calculateCohortDecay", () => {
    it("should compute accurate percentage retention milestones", () => {
      const decay = calculateCohortDecay(1000, 450, 300, 200, 150);
      expect(decay.day7).toBe(45.0);
      expect(decay.day14).toBe(30.0);
      expect(decay.day30).toBe(20.0);
      expect(decay.day60).toBe(15.0);
    });
  });
});
