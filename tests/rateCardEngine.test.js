const {
  NICHE_BENCHMARK_CPM,
  calculateBaselineRate,
  calculateSponsorshipQuote,
} = require("../services/rateCardEngine");

describe("Sponsorship Rate Card & Pricing Engine Unit Tests", () => {
  describe("calculateBaselineRate", () => {
    it("should compute base rate based on views and niche CPM", () => {
      // 10,000 views in tech ($35 CPM) at standard 4% engagement (1.0x) = $350
      const rate = calculateBaselineRate({
        niche: "tech",
        estimatedViews: 10000,
        engagementRatePercent: 4.0,
      });
      expect(rate).toBe(350.0);
    });

    it("should apply 1.5x bonus for exceptional engagement (>10%)", () => {
      // 10,000 views in finance ($45 CPM) * 1.5 = $675
      const rate = calculateBaselineRate({
        niche: "finance",
        estimatedViews: 10000,
        engagementRatePercent: 12.0,
      });
      expect(rate).toBe(675.0);
    });
  });

  describe("calculateSponsorshipQuote", () => {
    const sampleDeliverables = [
      { deliverableType: "dedicated_video", basePrice: 1500 },
      { deliverableType: "reel_or_short", basePrice: 500 },
    ];

    it("should compute quote with usage surcharge and 2-item bundle discount", () => {
      // Subtotal: 1500 + 500 = 2000
      // 90 days usage (+50% = 1000)
      // Gross: 3000
      // 2 deliverables bundle discount: 10% of 3000 = 300
      // Final total: 2700
      const quote = calculateSponsorshipQuote({
        deliverables: sampleDeliverables,
        usageRightsOption: "days_90",
        exclusivityOption: "none",
        twoDiscountPercent: 10,
        threePlusDiscountPercent: 20,
      });

      expect(quote.subtotal).toBe(2000);
      expect(quote.usageSurcharge).toBe(1000);
      expect(quote.grossTotal).toBe(3000);
      expect(quote.discountPercent).toBe(10);
      expect(quote.discountAmount).toBe(300);
      expect(quote.finalTotal).toBe(2700);
    });

    it("should apply 3+ item bundle discount and exclusivity", () => {
      const threeDeliverables = [
        ...sampleDeliverables,
        { deliverableType: "story_sequence", basePrice: 300 },
      ]; // Subtotal: 2300

      const quote = calculateSponsorshipQuote({
        deliverables: threeDeliverables,
        usageRightsOption: "organic_only",
        exclusivityOption: "days_30", // +30% = 690
        whitelistingAllowed: true, // +35% = 805
        twoDiscountPercent: 10,
        threePlusDiscountPercent: 20,
      });

      expect(quote.subtotal).toBe(2300);
      expect(quote.exclusivitySurcharge).toBe(690);
      expect(quote.whitelistingSurcharge).toBe(805);
      expect(quote.discountPercent).toBe(20);
      expect(quote.deliverablesCount).toBe(3);
    });
  });
});
