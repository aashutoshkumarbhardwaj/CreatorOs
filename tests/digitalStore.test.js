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
        it("should only query active products for public product details", async () => {
      const productId = new mongoose.Types.ObjectId();

      const findOneSpy = jest
        .spyOn(DigitalProduct, "findOne")
        .mockResolvedValue(null);

      const req = {
        params: {
          idOrSlug: productId.toString(),
        },
        route: {
          path: "/public/product/:idOrSlug",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await digitalStoreController.getProductDetails(req, res);

      expect(findOneSpy).toHaveBeenCalledWith({
        _id: productId.toString(),
        status: "active",
      });

      expect(res.status).toHaveBeenCalledWith(404);

      findOneSpy.mockRestore();
    });
    
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

  describe("Digital Store getProducts Pagination & Filter Validation", () => {
    let seededProducts = [];

    beforeAll(async () => {
      const docs = [];
      for (let i = 1; i <= 25; i++) {
        docs.push({
          creatorId: dummyCreatorId,
          title: `Pagination Product ${i.toString().padStart(2, "0")}`,
          slug: `pagination-product-${i}`,
          price: 10 + i,
          fileUrl: `https://storage.creatoros.io/assets/product-${i}.zip`,
          status: "active",
          category: i % 2 === 0 ? "preset" : "ebook",
        });
      }
      seededProducts = await DigitalProduct.insertMany(docs);
    });

    afterAll(async () => {
      await DigitalProduct.deleteMany({ _id: { $in: seededProducts.map((p) => p._id) } });
    });

    function createMockRes() {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    }

    it("should use default pagination (page=1, limit=20) when no params provided", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString() }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.success).toBe(true);
      expect(data.page).toBe(1);
      expect(data.count).toBe(20);
      expect(data.total).toBe(25);
      expect(data.pages).toBe(2);
      expect(data.products).toHaveLength(20);
    });

    it("should paginate correctly with valid page and limit (page=2, limit=10)", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "2", limit: "10" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.success).toBe(true);
      expect(data.page).toBe(2);
      expect(data.count).toBe(10);
      expect(data.total).toBe(25);
      expect(data.pages).toBe(3);
      expect(data.products).toHaveLength(10);
    });

    it("should safely default page to 1 when page=0 without 500 error", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "0", limit: "20" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.page).toBe(1);
      expect(data.products).toHaveLength(20);
    });

    it("should safely default page to 1 when page=-1 without 500 error", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "-1", limit: "20" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.page).toBe(1);
      expect(data.products).toHaveLength(20);
    });

    it("should safely default page to 1 when page=abc", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "abc", limit: "20" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.page).toBe(1);
      expect(data.products).toHaveLength(20);
    });

    it("should safely default page to 1 when page=NaN", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "NaN", limit: "20" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.page).toBe(1);
      expect(data.products).toHaveLength(20);
    });

    it("should safely default page to 1 when page=Infinity", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "Infinity", limit: "20" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.page).toBe(1);
      expect(data.products).toHaveLength(20);
    });

    it("should truncate fractional page (page=1.5) to integer 1 without fractional skip", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "1.5", limit: "20" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.page).toBe(1);
      expect(data.products).toHaveLength(20);
    });

    it("should fall back to default limit (20) when limit=0 and not dump entire collection", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "1", limit: "0" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.count).toBe(20);
      expect(data.products).toHaveLength(20);
      expect(data.pages).toBe(2);
    });

    it("should fall back to default limit (20) when limit=-10", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "1", limit: "-10" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.count).toBe(20);
      expect(data.products).toHaveLength(20);
      expect(data.pages).toBe(2);
    });

    it("should fall back to default limit (20) when limit=abc", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "1", limit: "abc" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.count).toBe(20);
      expect(data.products).toHaveLength(20);
      expect(data.pages).toBe(2);
    });

    it("should fall back to default limit (20) when limit=NaN", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "1", limit: "NaN" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.count).toBe(20);
      expect(data.products).toHaveLength(20);
    });

    it("should fall back to default limit (20) when limit=Infinity", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "1", limit: "Infinity" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.count).toBe(20);
      expect(data.products).toHaveLength(20);
    });

    it("should cap excessively large limit (limit=1000000) at MAX_LIMIT (100)", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), page: "1", limit: "1000000" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.total).toBe(25);
      expect(data.count).toBe(25);
      expect(data.pages).toBe(1);
    });

    it("should work in combination with category filter and pagination", async () => {
      const req = { query: { creatorId: dummyCreatorId.toString(), category: "preset", page: "1", limit: "5" }, user: null };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.success).toBe(true);
      expect(data.page).toBe(1);
      expect(data.count).toBe(5);
      expect(data.total).toBe(12);
      expect(data.pages).toBe(3);
      data.products.forEach((p) => expect(p.category).toBe("preset"));
    });

    it("should work in combination with status filter and pagination for authenticated creator", async () => {
      const req = { query: { status: "active", page: "1", limit: "10" }, user: { _id: dummyCreatorId } };
      const res = createMockRes();

      await digitalStoreController.getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0];
      expect(data.success).toBe(true);
      expect(data.total).toBe(25);
      expect(data.count).toBe(10);
      data.products.forEach((p) => expect(p.status).toBe("active"));
    });
  });
});
