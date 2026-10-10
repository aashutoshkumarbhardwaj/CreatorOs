const mongoose = require("mongoose");
const { DigitalProduct, DigitalOrder } = require("../model/digitalProduct");
const controller = require("../controller/digitalStoreController");
const {
  mergeCouponsPreservingUsage,
  evaluateDownloadAccess,
} = require("../services/digitalStoreService");

function createRes() {
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

async function checkout(body) {
  const res = createRes();
  await controller.createCheckoutOrder({ body: { customerEmail: "buyer@example.com", ...body } }, res);
  return res;
}

async function download(token) {
  const res = createRes();
  await controller.validateAndConsumeDownload({ params: { token } }, res);
  return res;
}

async function refund(creatorId, orderId) {
  const res = createRes();
  await controller.refundOrder({ user: { _id: creatorId }, params: { orderId: orderId.toString() } }, res);
  return res;
}

describe("Digital store atomic state transitions", () => {
  const creatorId = new mongoose.Types.ObjectId();
  let product;

  beforeEach(async () => {
    await DigitalProduct.deleteMany({});
    await DigitalOrder.deleteMany({});
    product = await DigitalProduct.create({
      creatorId,
      title: "Atomic Pack",
      slug: "atomic-pack",
      price: 100,
      fileUrl: "https://storage.creatoros.io/assets/atomic.zip",
      status: "active",
      maxDownloadsPerPurchase: 3,
      coupons: [{ code: "ONCE", discountPercent: 50, active: true, usageLimit: 1 }],
    });
  });

  it("lets a limited coupon be redeemed by only one of many concurrent checkouts", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkout({ productId: product._id.toString(), couponCode: "ONCE" }))
    );

    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    results
      .filter((r) => r.statusCode !== 201)
      .forEach((r) => expect(r.body.message).toBe("Coupon usage limit reached"));

    const refreshed = await DigitalProduct.findById(product._id);
    expect(refreshed.coupons[0].timesUsed).toBe(1);
    expect(await DigitalOrder.countDocuments({ productId: product._id })).toBe(1);
  });

  it("counts every concurrent sale in the product stats", async () => {
    await Promise.all(Array.from({ length: 8 }, () => checkout({ productId: product._id.toString() })));

    const refreshed = await DigitalProduct.findById(product._id);
    expect(refreshed.totalSales).toBe(8);
    expect(refreshed.totalRevenue).toBe(800);
  });

  it("gives the coupon redemption back when the order cannot be created", async () => {
    const saveSpy = jest.spyOn(DigitalOrder.prototype, "save").mockRejectedValueOnce(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const failed = await checkout({ productId: product._id.toString(), couponCode: "ONCE" });
    expect(failed.statusCode).toBe(500);
    expect((await DigitalProduct.findById(product._id)).coupons[0].timesUsed).toBe(0);

    const retry = await checkout({ productId: product._id.toString(), couponCode: "ONCE" });
    expect(retry.statusCode).toBe(201);

    saveSpy.mockRestore();
    console.error.mockRestore();
  });

  it("never authorizes more downloads than maxDownloads under parallel requests", async () => {
    const { body } = await checkout({ productId: product._id.toString() });

    const results = await Promise.all(Array.from({ length: 10 }, () => download(body.downloadToken)));

    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(3);
    results.filter((r) => r.statusCode !== 200).forEach((r) => expect(r.statusCode).toBe(429));

    const order = await DigitalOrder.findOne({ productId: product._id });
    expect(order.downloadTokens[0].downloadCount).toBe(3);
  });

  it("reverses revenue once when the same order is refunded concurrently", async () => {
    await checkout({ productId: product._id.toString() });
    await checkout({ productId: product._id.toString() });
    const order = await DigitalOrder.findOne({ productId: product._id });

    const results = await Promise.all([refund(creatorId, order._id), refund(creatorId, order._id)]);

    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 400)).toHaveLength(1);
    expect((await DigitalProduct.findById(product._id)).totalRevenue).toBe(100);
  });

  it("revokes every token on refund and blocks later downloads", async () => {
    const { body } = await checkout({ productId: product._id.toString() });
    const order = await DigitalOrder.findOne({ productId: product._id });

    expect((await refund(creatorId, order._id)).statusCode).toBe(200);

    const refreshed = await DigitalOrder.findById(order._id);
    expect(refreshed.orderStatus).toBe("refunded");
    expect(refreshed.downloadTokens.every((t) => t.revoked)).toBe(true);
    expect((await download(body.downloadToken)).statusCode).toBe(403);
  });

  it("does not refund an order that belongs to another creator", async () => {
    await checkout({ productId: product._id.toString() });
    const order = await DigitalOrder.findOne({ productId: product._id });

    const res = await refund(new mongoose.Types.ObjectId(), order._id);
    expect(res.statusCode).toBe(404);
    expect((await DigitalOrder.findById(order._id)).orderStatus).toBe("completed");
  });

  it("keeps coupon redemption counts when a creator edits the product", async () => {
    await DigitalProduct.updateOne({ _id: product._id }, { $set: { "coupons.0.timesUsed": 4, "coupons.0.usageLimit": 5 } });

    const res = createRes();
    await controller.updateProduct(
      {
        user: { _id: creatorId },
        params: { id: product._id.toString() },
        body: {
          coupons: [
            { code: "ONCE", discountPercent: 50, active: true, usageLimit: 5 },
            { code: "FRESH", discountPercent: 10, timesUsed: 99 },
          ],
        },
      },
      res
    );

    expect(res.statusCode).toBe(200);
    const refreshed = await DigitalProduct.findById(product._id);
    expect(refreshed.coupons.find((c) => c.code === "ONCE").timesUsed).toBe(4);
    expect(refreshed.coupons.find((c) => c.code === "FRESH").timesUsed).toBe(0);
  });
});

describe("digitalStoreService helpers", () => {
  it("mergeCouponsPreservingUsage ignores client supplied timesUsed", () => {
    const existing = [{ _id: "a", code: "KEEP", timesUsed: 7 }];
    const merged = mergeCouponsPreservingUsage(existing, [
      { code: "keep", discountPercent: 20, timesUsed: 0 },
      { code: "NEW", discountPercent: 5, timesUsed: 50 },
    ]);

    expect(merged[0]).toMatchObject({ _id: "a", discountPercent: 20, timesUsed: 7 });
    expect(merged[1]).toMatchObject({ code: "NEW", timesUsed: 0 });
  });

  it("evaluateDownloadAccess reports the right denial reason", () => {
    const future = new Date(Date.now() + 60000);
    const order = (token, status = "completed") => ({ orderStatus: status, downloadTokens: [token] });
    const base = { token: "t", downloadCount: 0, maxDownloads: 1, expiresAt: future, revoked: false };

    expect(evaluateDownloadAccess(null, "t").status).toBe(404);
    expect(evaluateDownloadAccess(order(base, "refunded"), "t").status).toBe(403);
    expect(evaluateDownloadAccess(order(base), "other").status).toBe(404);
    expect(evaluateDownloadAccess(order({ ...base, revoked: true }), "t").status).toBe(403);
    expect(evaluateDownloadAccess(order({ ...base, expiresAt: new Date(0) }), "t").status).toBe(410);
    expect(evaluateDownloadAccess(order({ ...base, downloadCount: 1 }), "t").status).toBe(429);
    expect(evaluateDownloadAccess(order(base), "t")).toBeNull();
  });
});
