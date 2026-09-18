const {
  computeWeightedForecast,
  findStalledDeals,
  calculateDeliverableFulfillment,
} = require("../services/crmPipelineForecastService");
const { DEFAULT_STAGE_PROBABILITIES } = require("../model/crmDeliverableContract");

describe("CRM Pipeline Forecasting & Deliverables Unit Tests", () => {
  describe("computeWeightedForecast", () => {
    it("should compute accurate gross and weighted revenue sums based on stage probabilities", () => {
      const deals = [
        {
          totalContractValue: 10000,
          stageProbabilityPercent: 50, // negotiation -> $5,000
          stage: "negotiation",
        },
        {
          totalContractValue: 20000,
          stageProbabilityPercent: 85, // contract_signed -> $17,000
          stage: "contract_signed",
        },
        {
          totalContractValue: 5000,
          stageProbabilityPercent: 10, // lead -> $500
          stage: "lead",
        },
      ];

      const forecast = computeWeightedForecast(deals);
      expect(forecast.totalPipelineGross).toBe(35000);
      expect(forecast.totalWeightedForecast).toBe(22500); // 5000 + 17000 + 500
      expect(forecast.activeDealsCount).toBe(3);
      expect(forecast.stageBreakdown.negotiation.count).toBe(1);
      expect(forecast.stageBreakdown.contract_signed.weightedValue).toBe(17000);
    });
  });

  describe("calculateDeliverableFulfillment", () => {
    it("should calculate correct percentage of approved/published deliverables", () => {
      const deliverables = [
        { title: "Video Draft", status: "published" },
        { title: "Instagram Reel", status: "approved_by_brand" },
        { title: "Twitter Thread", status: "drafting" },
        { title: "Story Set", status: "submitted_for_review" },
      ];

      const fulfillment = calculateDeliverableFulfillment(deliverables);
      expect(fulfillment.total).toBe(4);
      expect(fulfillment.completed).toBe(2);
      expect(fulfillment.percent).toBe(50.0);
    });
  });

  describe("findStalledDeals", () => {
    it("should flag active deals that have exceeded inactivity threshold", () => {
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      const deals = [
        {
          _id: "deal_stalled",
          brandName: "Acme Corp",
          stage: "pitch",
          totalContractValue: 5000,
          lastActivityAt: twentyDaysAgo,
        },
        {
          _id: "deal_active",
          brandName: "Beta Brand",
          stage: "negotiation",
          totalContractValue: 8000,
          lastActivityAt: twoDaysAgo,
        },
        {
          _id: "deal_lost",
          brandName: "Closed Lost",
          stage: "lost",
          lastActivityAt: twentyDaysAgo,
        },
      ];

      const stalled = findStalledDeals(deals, 14);
      expect(stalled).toHaveLength(1);
      expect(stalled[0].id).toBe("deal_stalled");
      expect(stalled[0].daysInactive).toBeGreaterThanOrEqual(19);
    });
  });
});
