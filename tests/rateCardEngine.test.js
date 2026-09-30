const {
  NICHE_BENCHMARK_CPM,
  calculateBaselineRate,
  calculateSponsorshipQuote,
  validateSponsorshipQuoteInputs,
} = require("../services/rateCardEngine");
const { calculateQuote } = require("../controller/rateCardController");

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

    it("should support valid zero price deliverables under existing business rules", () => {
      const quote = calculateSponsorshipQuote({
        deliverables: [{ deliverableType: "bonus_story", basePrice: 0 }],
      });

      expect(quote.subtotal).toBe(0);
      expect(quote.grossTotal).toBe(0);
      expect(quote.finalTotal).toBe(0);
      expect(quote.deliverablesCount).toBe(1);
    });

    it("should support decimal prices and maintain precision", () => {
      const quote = calculateSponsorshipQuote({
        deliverables: [
          { deliverableType: "dedicated_video", basePrice: 1500.5 },
          { deliverableType: "reel_or_short", basePrice: 499.75 },
        ],
        twoDiscountPercent: 10,
      });

      expect(quote.subtotal).toBe(2000.25);
      expect(quote.grossTotal).toBe(2000.25);
      expect(quote.discountAmount).toBe(200.03);
      expect(quote.finalTotal).toBe(1800.22);
    });

    it("should handle empty deliverables array according to business rules", () => {
      const quote = calculateSponsorshipQuote({ deliverables: [] });

      expect(quote.subtotal).toBe(0);
      expect(quote.grossTotal).toBe(0);
      expect(quote.finalTotal).toBe(0);
      expect(quote.deliverablesCount).toBe(0);
    });

    it("should support 0% and 100% boundary discounts", () => {
      const quoteZeroDiscount = calculateSponsorshipQuote({
        deliverables: sampleDeliverables,
        twoDiscountPercent: 0,
      });
      expect(quoteZeroDiscount.discountPercent).toBe(0);
      expect(quoteZeroDiscount.discountAmount).toBe(0);
      expect(quoteZeroDiscount.finalTotal).toBe(2000);

      const quoteFullDiscount = calculateSponsorshipQuote({
        deliverables: sampleDeliverables,
        twoDiscountPercent: 100,
      });
      expect(quoteFullDiscount.discountPercent).toBe(100);
      expect(quoteFullDiscount.discountAmount).toBe(2000);
      expect(quoteFullDiscount.finalTotal).toBe(0);
    });

    describe("deliverables input validation", () => {
      it("should reject missing deliverables or null deliverables", () => {
        expect(() => calculateSponsorshipQuote({ deliverables: null })).toThrow(TypeError);
        expect(() =>
          validateSponsorshipQuoteInputs({ deliverables: undefined })
        ).toThrow(TypeError);
      });

      it("should reject deliverables when provided as string or object", () => {
        expect(() => calculateSponsorshipQuote({ deliverables: "video" })).toThrow(TypeError);
        expect(() => calculateSponsorshipQuote({ deliverables: { basePrice: 100 } })).toThrow(
          TypeError
        );
      });

      it("should reject deliverable that is null or not an object", () => {
        expect(() => calculateSponsorshipQuote({ deliverables: [null] })).toThrow(TypeError);
        expect(() => calculateSponsorshipQuote({ deliverables: ["not-an-object"] })).toThrow(
          TypeError
        );
        expect(() => calculateSponsorshipQuote({ deliverables: [[]] })).toThrow(TypeError);
      });

      it("should reject deliverable with missing basePrice", () => {
        expect(() =>
          calculateSponsorshipQuote({ deliverables: [{ deliverableType: "dedicated_video" }] })
        ).toThrow(TypeError);
      });

      it("should reject deliverable with null, empty, or boolean basePrice", () => {
        expect(() => calculateSponsorshipQuote({ deliverables: [{ basePrice: null }] })).toThrow(
          TypeError
        );
        expect(() => calculateSponsorshipQuote({ deliverables: [{ basePrice: "" }] })).toThrow(
          TypeError
        );
        expect(() => calculateSponsorshipQuote({ deliverables: [{ basePrice: "   " }] })).toThrow(
          TypeError
        );
        expect(() => calculateSponsorshipQuote({ deliverables: [{ basePrice: true }] })).toThrow(
          TypeError
        );
      });
    });

    describe("price validation", () => {
      it("should reject negative deliverable price", () => {
        expect(() => calculateSponsorshipQuote({ deliverables: [{ basePrice: -100 }] })).toThrow(
          RangeError
        );
      });

      it("should reject non-numeric string price", () => {
        expect(() => calculateSponsorshipQuote({ deliverables: [{ basePrice: "abc" }] })).toThrow(
          TypeError
        );
      });

      it("should reject NaN price", () => {
        expect(() => calculateSponsorshipQuote({ deliverables: [{ basePrice: NaN }] })).toThrow(
          TypeError
        );
      });

      it("should reject Infinity and -Infinity prices", () => {
        expect(() =>
          calculateSponsorshipQuote({ deliverables: [{ basePrice: Infinity }] })
        ).toThrow(TypeError);
        expect(() =>
          calculateSponsorshipQuote({ deliverables: [{ basePrice: -Infinity }] })
        ).toThrow(TypeError);
      });
    });

    describe("discount validation", () => {
      it("should reject negative discount percentage", () => {
        expect(() =>
          calculateSponsorshipQuote({ deliverables: sampleDeliverables, twoDiscountPercent: -10 })
        ).toThrow(RangeError);
        expect(() =>
          calculateSponsorshipQuote({
            deliverables: sampleDeliverables,
            threePlusDiscountPercent: -5,
          })
        ).toThrow(RangeError);
      });

      it("should reject discount percentage greater than 100", () => {
        expect(() =>
          calculateSponsorshipQuote({ deliverables: sampleDeliverables, twoDiscountPercent: 101 })
        ).toThrow(RangeError);
        expect(() =>
          calculateSponsorshipQuote({
            deliverables: sampleDeliverables,
            threePlusDiscountPercent: 150,
          })
        ).toThrow(RangeError);
      });

      it("should reject non-numeric and boolean discount values", () => {
        expect(() =>
          calculateSponsorshipQuote({
            deliverables: sampleDeliverables,
            twoDiscountPercent: "invalid",
          })
        ).toThrow(TypeError);
        expect(() =>
          calculateSponsorshipQuote({
            deliverables: sampleDeliverables,
            twoDiscountPercent: true,
          })
        ).toThrow(TypeError);
      });

      it("should reject non-finite discount values (NaN, Infinity)", () => {
        expect(() =>
          calculateSponsorshipQuote({ deliverables: sampleDeliverables, twoDiscountPercent: NaN })
        ).toThrow(TypeError);
        expect(() =>
          calculateSponsorshipQuote({
            deliverables: sampleDeliverables,
            twoDiscountPercent: Infinity,
          })
        ).toThrow(TypeError);
      });
    });

    describe("options validation", () => {
      it("should reject invalid usageRightsOption", () => {
        expect(() =>
          calculateSponsorshipQuote({
            deliverables: sampleDeliverables,
            usageRightsOption: "invalid_option",
          })
        ).toThrow(RangeError);
      });

      it("should reject invalid exclusivityOption", () => {
        expect(() =>
          calculateSponsorshipQuote({
            deliverables: sampleDeliverables,
            exclusivityOption: "invalid_option",
          })
        ).toThrow(RangeError);
      });
    });
  });

  describe("rateCardController.calculateQuote API", () => {
    function mockResponse() {
      const res = {
        statusCode: null,
        data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.data = payload;
          return this;
        },
      };
      return res;
    }

    it("should return HTTP 400 when request body is missing or not an object", async () => {
      const req = { body: null };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toBe("Request body must be a valid JSON object");
    });

    it("should return HTTP 400 when deliverables is missing or null", async () => {
      const req = { body: {} };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/deliverables is required/i);
    });

    it("should return HTTP 400 when deliverables is not an array", async () => {
      const req = { body: { deliverables: "not-an-array" } };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/deliverables must be an array/i);
    });

    it("should return HTTP 400 when deliverable has negative basePrice", async () => {
      const req = {
        body: {
          deliverables: [{ basePrice: -100 }],
        },
      };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/basePrice must be non-negative/i);
    });

    it("should return HTTP 400 when deliverable has non-numeric basePrice", async () => {
      const req = {
        body: {
          deliverables: [{ basePrice: "abc" }],
        },
      };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/basePrice must be a finite number/i);
    });

    it("should return HTTP 400 when deliverable basePrice is Infinity", async () => {
      const req = {
        body: {
          deliverables: [{ basePrice: Infinity }],
        },
      };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/basePrice must be a finite number/i);
    });

    it("should return HTTP 400 when discount is greater than 100", async () => {
      const req = {
        body: {
          deliverables: [{ basePrice: 100 }, { basePrice: 200 }],
          twoDiscountPercent: 150,
        },
      };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/between 0 and 100/i);
    });

    it("should return HTTP 400 when discount is negative", async () => {
      const req = {
        body: {
          deliverables: [{ basePrice: 100 }, { basePrice: 200 }],
          twoDiscountPercent: -10,
        },
      };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/between 0 and 100/i);
    });

    it("should return HTTP 200 with quote calculation for valid requests", async () => {
      const req = {
        body: {
          deliverables: [
            { deliverableType: "dedicated_video", basePrice: 1500 },
            { deliverableType: "reel_or_short", basePrice: 500 },
          ],
          usageRightsOption: "days_90",
          twoDiscountPercent: 10,
        },
      };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.quote.subtotal).toBe(2000);
      expect(res.data.quote.finalTotal).toBe(2700);
    });

    it("should return HTTP 200 with zero quote for empty deliverables array", async () => {
      const req = {
        body: {
          deliverables: [],
        },
      };
      const res = mockResponse();

      await calculateQuote(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.quote.subtotal).toBe(0);
      expect(res.data.quote.finalTotal).toBe(0);
      expect(res.data.quote.deliverablesCount).toBe(0);
    });
  });
});
