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

describe("Digital Store access control and atomic state changes", () => {
  const ownerId = new mongoose.Types.ObjectId();
  const otherCreatorId = new mongoose.Types.ObjectId();
  const PAID_FILE = "https://storage.creatoros.io/assets/paid-presets.zip";
  let slugCounter = 0;

  function mockRes() {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        res.statusCode = code;
        return res;
      },
      json(payload) {
        res.body = payload;
        return res;
      },
    };
    return res;
  }

  async function seedProduct(overrides = {}) {
    slugCounter += 1;
    return DigitalProduct.create({
      creatorId: ownerId,
      title: `Presets ${slugCounter}`,
      slug: `presets-${slugCounter}`,
      price: 100,
      fileUrl: PAID_FILE,
      status: "active",
      maxDownloadsPerPurchase: 3,
      coupons: [],
      ...overrides,
    });
  }

  async function checkout(product, extra = {}) {
    const res = mockRes();
    await digitalStoreController.createCheckoutOrder(
      { body: { productId: String(product._id), customerEmail: `buyer${++slugCounter}@example.com`, ...extra } },
      res
    );
    return res;
  }

  async function download(token) {
    const res = mockRes();
    await digitalStoreController.validateAndConsumeDownload({ params: { token } }, res);
    return res;
  }

  beforeEach(async () => {
    await DigitalProduct.deleteMany({});
    await DigitalOrder.deleteMany({});
  });

  describe("public storefront never exposes the paid asset", () => {
    it("hides fileUrl and coupons from anonymous visitors on the product page", async () => {
      const product = await seedProduct({
        coupons: [{ code: "SECRET50", discountPercent: 50, active: true }],
      });

      const res = mockRes();
      await digitalStoreController.getProductDetails({ params: { idOrSlug: String(product._id) } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.product.title).toBe(product.title);
      expect(res.body.product.fileUrl).toBeUndefined();
      expect(res.body.product.coupons).toBeUndefined();
    });

    it("hides fileUrl and coupons from other signed-in creators", async () => {
      const product = await seedProduct({
        coupons: [{ code: "SECRET50", discountPercent: 50, active: true }],
      });

      const res = mockRes();
      await digitalStoreController.getProductDetails(
        { user: { _id: otherCreatorId }, params: { idOrSlug: String(product._id) } },
        res
      );

      expect(res.body.product.fileUrl).toBeUndefined();
      expect(res.body.product.coupons).toBeUndefined();
    });

    it("still shows the owner their own fileUrl and coupons", async () => {
      const product = await seedProduct({
        coupons: [{ code: "SECRET50", discountPercent: 50, active: true }],
      });

      const res = mockRes();
      await digitalStoreController.getProductDetails(
        { user: { _id: ownerId }, params: { idOrSlug: String(product._id) } },
        res
      );

      expect(res.body.product.fileUrl).toBe(PAID_FILE);
      expect(res.body.product.coupons).toHaveLength(1);
    });

    it("returns 404 for draft products to everyone except the owner", async () => {
      const draft = await seedProduct({ status: "draft" });

      const anonymous = mockRes();
      await digitalStoreController.getProductDetails({ params: { idOrSlug: String(draft._id) } }, anonymous);
      expect(anonymous.statusCode).toBe(404);

      const owner = mockRes();
      await digitalStoreController.getProductDetails(
        { user: { _id: ownerId }, params: { idOrSlug: String(draft._id) } },
        owner
      );
      expect(owner.statusCode).toBe(200);
    });

    it("lists only active products, without owner-only fields, even when ?status=draft is requested", async () => {
      await seedProduct({ status: "active", coupons: [{ code: "SECRET50", discountPercent: 50, active: true }] });
      await seedProduct({ status: "draft" });
      await seedProduct({ status: "archived" });

      const res = mockRes();
      await digitalStoreController.getProducts({ query: { status: "draft" } }, res);

      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].status).toBe("active");
      expect(res.body.products[0].fileUrl).toBeUndefined();
      expect(res.body.products[0].coupons).toBeUndefined();

      const byCreator = mockRes();
      await digitalStoreController.getProducts({ query: { creatorId: String(ownerId), status: "archived" } }, byCreator);
      expect(byCreator.body.products).toHaveLength(1);
      expect(byCreator.body.products[0].status).toBe("active");
    });

    it("lets a creator list their own drafts with fileUrl", async () => {
      await seedProduct({ status: "active" });
      await seedProduct({ status: "draft" });

      const res = mockRes();
      await digitalStoreController.getProducts({ user: { _id: ownerId }, query: { status: "draft" } }, res);

      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].status).toBe("draft");
      expect(res.body.products[0].fileUrl).toBe(PAID_FILE);
    });
  });

  describe("checkout under concurrency", () => {
    it("never lets parallel buyers exceed a coupon's usageLimit", async () => {
      const product = await seedProduct({
        coupons: [{ code: "VIP", discountPercent: 50, active: true, usageLimit: 1, timesUsed: 0 }],
      });

      const results = await Promise.all(Array.from({ length: 6 }, () => checkout(product, { couponCode: "VIP" })));

      const created = results.filter((r) => r.statusCode === 201);
      const rejected = results.filter((r) => r.statusCode !== 201);
      expect(created).toHaveLength(1);
      expect(rejected.every((r) => r.statusCode === 409 || r.statusCode === 400)).toBe(true);

      const stored = await DigitalProduct.findById(product._id);
      expect(stored.coupons[0].timesUsed).toBe(1);
      expect(stored.totalSales).toBe(1);
      expect(stored.totalRevenue).toBe(50);
      expect(await DigitalOrder.countDocuments({ productId: product._id })).toBe(1);
    });

    it("keeps sales and revenue counters exact when many orders complete in parallel", async () => {
      const product = await seedProduct();

      const results = await Promise.all(Array.from({ length: 8 }, () => checkout(product)));

      expect(results.every((r) => r.statusCode === 201)).toBe(true);
      const stored = await DigitalProduct.findById(product._id);
      expect(stored.totalSales).toBe(8);
      expect(stored.totalRevenue).toBe(800);
    });

    it("gives the coupon use back when the order cannot be saved", async () => {
      const product = await seedProduct({
        coupons: [{ code: "VIP", discountPercent: 50, active: true, usageLimit: 1, timesUsed: 0 }],
      });
      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(DigitalOrder.prototype, "save").mockRejectedValueOnce(new Error("db down"));

      const failed = await checkout(product, { couponCode: "VIP" });
      expect(failed.statusCode).toBe(500);
      expect((await DigitalProduct.findById(product._id)).coupons[0].timesUsed).toBe(0);

      const retry = await checkout(product, { couponCode: "VIP" });
      expect(retry.statusCode).toBe(201);
      jest.restoreAllMocks();
    });
  });

  describe("downloads and refunds under concurrency", () => {
    it("grants exactly maxDownloads parallel downloads and counts every one", async () => {
      const product = await seedProduct({ maxDownloadsPerPurchase: 3 });
      const { downloadToken } = (await checkout(product)).body;

      const results = await Promise.all(Array.from({ length: 12 }, () => download(downloadToken)));

      const granted = results.filter((r) => r.statusCode === 200);
      expect(granted).toHaveLength(3);
      expect(granted.map((r) => r.body.remainingDownloads).sort()).toEqual([0, 1, 2]);
      expect(results.filter((r) => r.statusCode === 429)).toHaveLength(9);

      const order = await DigitalOrder.findOne({ "downloadTokens.token": downloadToken });
      expect(order.downloadTokens[0].downloadCount).toBe(3);
    });

    it("applies a refund once, however many refund requests arrive together", async () => {
      const product = await seedProduct();
      const first = await checkout(product);
      await checkout(product);
      expect((await DigitalProduct.findById(product._id)).totalRevenue).toBe(200);

      const refunds = await Promise.all(
        [1, 2, 3].map(async () => {
          const res = mockRes();
          await digitalStoreController.refundOrder(
            { user: { _id: ownerId }, params: { orderId: String(first.body.orderId) } },
            res
          );
          return res;
        })
      );

      expect(refunds.filter((r) => r.statusCode === 200)).toHaveLength(1);
      expect(refunds.filter((r) => r.statusCode === 400)).toHaveLength(2);
      expect((await DigitalProduct.findById(product._id)).totalRevenue).toBe(100);
    });

    it("blocks downloads after a refund and revokes every token", async () => {
      const product = await seedProduct();
      const purchase = await checkout(product);

      const refund = mockRes();
      await digitalStoreController.refundOrder(
        { user: { _id: ownerId }, params: { orderId: String(purchase.body.orderId) } },
        refund
      );
      expect(refund.statusCode).toBe(200);

      const denied = await download(purchase.body.downloadToken);
      expect(denied.statusCode).toBe(403);

      const order = await DigitalOrder.findById(purchase.body.orderId);
      expect(order.orderStatus).toBe("refunded");
      expect(order.downloadTokens.every((t) => t.revoked)).toBe(true);
    });

    it("never leaves a refunded order 'completed' when a download lands at the same moment", async () => {
      const product = await seedProduct();
      const purchase = await checkout(product);

      await Promise.all([
        digitalStoreController.refundOrder(
          { user: { _id: ownerId }, params: { orderId: String(purchase.body.orderId) } },
          mockRes()
        ),
        download(purchase.body.downloadToken),
        download(purchase.body.downloadToken),
      ]);

      const order = await DigitalOrder.findById(purchase.body.orderId);
      expect(order.orderStatus).toBe("refunded");
      expect(order.downloadTokens[0].revoked).toBe(true);
    });

    it("does not spend a download when the order is expired or revoked", async () => {
      const product = await seedProduct();
      const purchase = await checkout(product);
      await DigitalOrder.updateOne(
        { _id: purchase.body.orderId },
        { $set: { "downloadTokens.0.expiresAt": new Date(Date.now() - 1000) } }
      );

      const res = await download(purchase.body.downloadToken);

      expect(res.statusCode).toBe(410);
      const order = await DigitalOrder.findById(purchase.body.orderId);
      expect(order.downloadTokens[0].downloadCount).toBe(0);
    });
  });
});

