const { DigitalProduct, DigitalOrder } = require("../model/digitalProduct");
const digitalStoreController = require("../controller/digitalStoreController");
const mongoose = require("mongoose");

describe("Digital Store & Monetization Engine Unit Tests", () => {
  const dummyCreatorId = new mongoose.Types.ObjectId();

  describe("DigitalProduct Schema Methods", () => {
    let sampleProduct;

    beforeEach(() => {
      sampleProduct = new DigitalProduct({
        creatorId: dummyCreatorId,
        title: "Pro Lightroom Presets 2026",
        slug: "pro-lightroom-presets-2026",
        price: 49.99,
        currency: "USD",
        fileUrl: "https://storage.creatoros.io/assets/presets.zip",
        maxDownloadsPerPurchase: 3,
        tokenExpiryHours: 24,
        coupons: [
          {
            code: "LAUNCH20",
            discountPercent: 20,
            active: true,
          },
          {
            code: "EXPIRED50",
            discountPercent: 50,
            active: true,
            expiresAt: new Date(Date.now() - 10000), // in the past
          },
          {
            code: "MAXEDOUT",
            discountPercent: 30,
            active: true,
            usageLimit: 5,
            timesUsed: 5,
          },
        ],
      });
    });

    it("should calculate correct discount for valid active coupon", () => {
      const result = sampleProduct.applyCoupon("LAUNCH20");
      expect(result.discount).toBe(10.0);
      expect(result.finalPrice).toBe(39.99);
      expect(result.coupon).toBeDefined();
    });

    it("should reject expired coupon", () => {
      const result = sampleProduct.applyCoupon("EXPIRED50");
      expect(result.error).toBe("Invalid or expired coupon");
      expect(result.finalPrice).toBe(49.99);
    });

    it("should reject coupon that exceeded usage limit", () => {
      const result = sampleProduct.applyCoupon("MAXEDOUT");
      expect(result.error).toBe("Coupon usage limit reached");
      expect(result.finalPrice).toBe(49.99);
    });

    it("should handle empty or nonexistent coupon codes gracefully", () => {
      const result = sampleProduct.applyCoupon("NONEXISTENT");
      expect(result.error).toBe("Invalid or expired coupon");
      expect(result.finalPrice).toBe(49.99);

      const nullResult = sampleProduct.applyCoupon(null);
      expect(nullResult.finalPrice).toBe(49.99);
      expect(nullResult.discount).toBe(0);
    });

    it("should generate cryptographically random download tokens with proper expiration", () => {
      const tokenObj = sampleProduct.generateDownloadToken();
      expect(tokenObj.token).toBeDefined();
      expect(typeof tokenObj.token).toBe("string");
      expect(tokenObj.token.length).toBe(64); // 32 bytes hex
      expect(tokenObj.downloadCount).toBe(0);
      expect(tokenObj.maxDownloads).toBe(3);
      expect(tokenObj.revoked).toBe(false);
      expect(new Date(tokenObj.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("Digital Store Controller Handlers Validation", () => {
    it("should reject product creation when required fields are missing", async () => {
      const req = {
        user: { _id: dummyCreatorId },
        body: {
          title: "Incomplete Product",
          // missing price and fileUrl
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await digitalStoreController.createProduct(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("required fields"),
        })
      );
    });

    it("should reject checkout when required fields are missing", async () => {
      const req = {
        body: {
          // missing productId and customerEmail
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await digitalStoreController.createCheckoutOrder(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });
});
