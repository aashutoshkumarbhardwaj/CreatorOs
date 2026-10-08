const mongoose = require("mongoose");
const { DigitalProduct, DigitalOrder } = require("../model/digitalProduct");
const controller = require("../controller/digitalStoreController");

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

const creatorId = new mongoose.Types.ObjectId();

async function makeProduct(overrides = {}) {
  return DigitalProduct.create({
    creatorId,
    title: "Concurrency Preset Pack",
    slug: `preset-${new mongoose.Types.ObjectId()}`,
    price: 100,
    fileUrl: "https://storage.creatoros.io/private/pack.zip",
    status: "active",
    maxDownloadsPerPurchase: 3,
    ...overrides,
  });
}

async function checkout(productId, extra = {}) {
  const res = mockRes();
  await controller.createCheckoutOrder(
    { body: { productId: productId.toString(), customerEmail: "buyer@example.com", ...extra } },
    res
  );
  return res;
}

async function download(token) {
  const res = mockRes();
  await controller.validateAndConsumeDownload({ params: { token } }, res);
  return res;
}

describe("Digital store: atomic limits under concurrency", () => {
  beforeEach(async () => {
    await DigitalProduct.deleteMany({});
    await DigitalOrder.deleteMany({});
  });

  afterAll(async () => {
    await DigitalProduct.deleteMany({});
    await DigitalOrder.deleteMany({});
  });

  describe("download token consumption", () => {
    it("never authorizes more downloads than maxDownloads when requests race", async () => {
      const product = await makeProduct(); // maxDownloads = 3
      const purchase = await checkout(product._id);
      expect(purchase.statusCode).toBe(201);
      const token = purchase.body.downloadToken;

      const results = await Promise.all(Array.from({ length: 20 }, () => download(token)));

      const authorized = results.filter((r) => r.statusCode === 200);
      const limited = results.filter((r) => r.statusCode === 429);
      expect(authorized).toHaveLength(3);
      expect(limited).toHaveLength(17);

      const order = await DigitalOrder.findById(purchase.body.orderId);
      expect(order.downloadTokens[0].downloadCount).toBe(3);

      const remaining = authorized.map((r) => r.body.remainingDownloads).sort();
      expect(remaining).toEqual([0, 1, 2]);
    });

    it("counts every download exactly once (no lost updates below the limit)", async () => {
      const product = await makeProduct({ maxDownloadsPerPurchase: 50 });
      const purchase = await checkout(product._id);

      const results = await Promise.all(
        Array.from({ length: 10 }, () => download(purchase.body.downloadToken))
      );

      expect(results.every((r) => r.statusCode === 200)).toBe(true);
      const order = await DigitalOrder.findById(purchase.body.orderId);
      expect(order.downloadTokens[0].downloadCount).toBe(10);
    });

    it("rejects unknown, expired and revoked tokens with the proper status codes", async () => {
      const product = await makeProduct();
      const purchase = await checkout(product._id);
      const orderId = purchase.body.orderId;

      expect((await download("does-not-exist")).statusCode).toBe(404);

      await DigitalOrder.updateOne(
        { _id: orderId },
        { $set: { "downloadTokens.0.expiresAt": new Date(Date.now() - 1000) } }
      );
      expect((await download(purchase.body.downloadToken)).statusCode).toBe(410);

      await DigitalOrder.updateOne(
        { _id: orderId },
        { $set: { "downloadTokens.0.expiresAt": new Date(Date.now() + 60000), "downloadTokens.0.revoked": true } }
      );
      expect((await download(purchase.body.downloadToken)).statusCode).toBe(403);
    });

    it("stops serving downloads as soon as the order is refunded", async () => {
      const product = await makeProduct();
      const purchase = await checkout(product._id);

      const refundRes = mockRes();
      await controller.refundOrder({ user: { _id: creatorId }, params: { orderId: purchase.body.orderId } }, refundRes);
      expect(refundRes.statusCode).toBe(200);

      const res = await download(purchase.body.downloadToken);
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/refunded/i);
    });
  });

  describe("coupon redemption and sales counters", () => {
    it("never redeems a coupon more often than its usageLimit", async () => {
      const product = await makeProduct({
        coupons: [{ code: "TWICE", discountPercent: 50, usageLimit: 2, active: true }],
      });

      const results = await Promise.all(
        Array.from({ length: 10 }, () => checkout(product._id, { couponCode: "TWICE" }))
      );

      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(2);
      const rejected = results.filter((r) => r.statusCode === 400);
      expect(rejected).toHaveLength(8);
      rejected.forEach((r) => expect(r.body.message).toBe("Coupon usage limit reached"));

      const fresh = await DigitalProduct.findById(product._id);
      expect(fresh.coupons[0].timesUsed).toBe(2);
      expect(fresh.totalSales).toBe(2);
      expect(fresh.totalRevenue).toBe(100); // 2 x 50.00
      expect(await DigitalOrder.countDocuments({ productId: product._id })).toBe(2);
    });

    it("does not lose sales/revenue updates when checkouts race", async () => {
      const product = await makeProduct();

      const results = await Promise.all(Array.from({ length: 12 }, () => checkout(product._id)));

      expect(results.every((r) => r.statusCode === 201)).toBe(true);
      const fresh = await DigitalProduct.findById(product._id);
      expect(fresh.totalSales).toBe(12);
      expect(fresh.totalRevenue).toBe(1200);
      expect(await DigitalOrder.countDocuments({ productId: product._id })).toBe(12);
    });

    it("rejects checkout for inactive products", async () => {
      const product = await makeProduct({ status: "draft" });
      const res = await checkout(product._id);
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Active product not found");
    });

    it("keeps the existing single-redemption coupon math", async () => {
      const product = await makeProduct({
        coupons: [{ code: "LAUNCH20", discountPercent: 20, active: true }],
      });
      const res = await checkout(product._id, { couponCode: "launch20" });
      expect(res.statusCode).toBe(201);
      const order = await DigitalOrder.findById(res.body.orderId);
      expect(order.amountPaid).toBe(80);
      expect(order.discountAmount).toBe(20);
      expect(order.appliedCoupon).toBe("LAUNCH20");
    });
  });

  describe("refunds", () => {
    it("refunds an order exactly once even when requests race", async () => {
      const product = await makeProduct();
      const [a, b] = [await checkout(product._id), await checkout(product._id)];
      expect(a.statusCode).toBe(201);
      expect(b.statusCode).toBe(201);
      // product revenue is now 200; refund order `a` (100) from many parallel requests
      const results = [];
      await Promise.all(
        Array.from({ length: 8 }, async () => {
          const res = mockRes();
          await controller.refundOrder(
            { user: { _id: creatorId }, params: { orderId: a.body.orderId } },
            res
          );
          results.push(res);
        })
      );

      expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
      expect(results.filter((r) => r.statusCode === 400)).toHaveLength(7);

      const fresh = await DigitalProduct.findById(product._id);
      expect(fresh.totalRevenue).toBe(100); // 200 - 100, deducted ONCE (was 0 with the double refund)
      const refunded = await DigitalOrder.findById(a.body.orderId);
      expect(refunded.orderStatus).toBe("refunded");
      expect(refunded.downloadTokens.every((t) => t.revoked)).toBe(true);
    });

    it("refuses to refund an order that belongs to another creator", async () => {
      const product = await makeProduct();
      const purchase = await checkout(product._id);
      const res = mockRes();
      await controller.refundOrder(
        { user: { _id: new mongoose.Types.ObjectId() }, params: { orderId: purchase.body.orderId } },
        res
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe("secrets are not exposed to the public", () => {
    it("hides fileUrl, coupons and revenue from the public product list", async () => {
      await makeProduct({
        coupons: [{ code: "SECRET50", discountPercent: 50, active: true }],
      });
      const res = mockRes();
      await controller.getProducts({ query: { creatorId: creatorId.toString() }, user: null }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.products).toHaveLength(1);
      const product = res.body.products[0];
      expect(product.fileUrl).toBeUndefined();
      expect(product.coupons).toBeUndefined();
      expect(product.totalRevenue).toBeUndefined();
      expect(product.title).toBe("Concurrency Preset Pack");
      expect(JSON.stringify(res.body)).not.toMatch(/SECRET50|storage\.creatoros\.io/);
    });

    it("hides secrets from the public product details but not from the owner", async () => {
      const product = await makeProduct({
        coupons: [{ code: "SECRET50", discountPercent: 50, active: true }],
      });

      const publicRes = mockRes();
      await controller.getProductDetails(
        { params: { idOrSlug: product._id.toString() }, route: { path: "/public/product/:idOrSlug" } },
        publicRes
      );
      expect(publicRes.statusCode).toBe(200);
      expect(publicRes.body.product.fileUrl).toBeUndefined();
      expect(publicRes.body.product.coupons).toBeUndefined();

      const ownerRes = mockRes();
      await controller.getProductDetails(
        { params: { idOrSlug: product._id.toString() }, route: { path: "/product/:idOrSlug" }, user: { _id: creatorId } },
        ownerRes
      );
      expect(ownerRes.body.product.fileUrl).toBe("https://storage.creatoros.io/private/pack.zip");
      expect(ownerRes.body.product.coupons).toHaveLength(1);
    });

    it("does not let another logged-in creator read a draft product or its secrets", async () => {
      const draft = await makeProduct({ status: "draft" });
      const active = await makeProduct();
      const stranger = { _id: new mongoose.Types.ObjectId() };

      const draftRes = mockRes();
      await controller.getProductDetails(
        { params: { idOrSlug: draft._id.toString() }, route: { path: "/product/:idOrSlug" }, user: stranger },
        draftRes
      );
      expect(draftRes.statusCode).toBe(404);

      const activeRes = mockRes();
      await controller.getProductDetails(
        { params: { idOrSlug: active._id.toString() }, route: { path: "/product/:idOrSlug" }, user: stranger },
        activeRes
      );
      expect(activeRes.statusCode).toBe(200);
      expect(activeRes.body.product.fileUrl).toBeUndefined();
    });

    it("still delivers the file URL through a valid download token", async () => {
      const product = await makeProduct();
      const purchase = await checkout(product._id);
      const res = await download(purchase.body.downloadToken);
      expect(res.statusCode).toBe(200);
      expect(res.body.fileUrl).toBe("https://storage.creatoros.io/private/pack.zip");
    });
  });
});
