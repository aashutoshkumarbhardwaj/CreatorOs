const { DigitalProduct, DigitalOrder } = require("../model/digitalProduct");

/**
 * Atomic primitives for the digital store.
 *
 * Every limit in the store (download count per token, coupon usage limit, "already refunded")
 * used to be enforced with read -> check -> modify -> save(). Under concurrent requests every
 * caller passes the check against the same stale snapshot, so limits could be bypassed and
 * counters lost updates. Here the check and the write are ONE conditional update on a single
 * document, which MongoDB applies atomically: either the limit still holds and the counter
 * moves, or nothing is written and the caller re-reads to find out why.
 *
 * Array elements are addressed by index (e.g. `downloadTokens.0.downloadCount`) and the filter
 * also pins the element's identity (token / coupon _id), so a stale index can never touch the
 * wrong element - it simply fails to match and the caller retries with fresh data.
 */

const MAX_ATTEMPTS = 5;

function fail(status, message) {
  return { error: { status, message } };
}

/** Pure check of a token's state, returning the same errors the controller always returned. */
function evaluateToken(order, token, now) {
  if (order.orderStatus === "refunded") {
    return fail(403, "Order has been refunded. Download access revoked.");
  }
  const index = order.downloadTokens.findIndex((t) => t.token === token);
  if (index === -1) return fail(404, "Invalid download token");

  const record = order.downloadTokens[index];
  if (record.revoked) return fail(403, "Download token has been revoked");
  if (now > new Date(record.expiresAt)) return fail(410, "Download link has expired");
  if (record.downloadCount >= record.maxDownloads) {
    return fail(429, "Maximum download limit reached for this token");
  }
  return { index, record };
}

/**
 * Validates a download token and consumes one download atomically.
 * @returns {Promise<{error}|{order, index, record, remaining}>}
 */
async function consumeDownloadToken(token, now = new Date()) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const order = await DigitalOrder.findOne({ "downloadTokens.token": token });
    if (!order) return fail(404, "Download token not found");

    const state = evaluateToken(order, token, now);
    if (state.error) return state;

    const path = `downloadTokens.${state.index}`;
    const updated = await DigitalOrder.findOneAndUpdate(
      {
        _id: order._id,
        orderStatus: { $ne: "refunded" },
        [`${path}.token`]: token,
        [`${path}.revoked`]: false,
        [`${path}.expiresAt`]: { $gt: now },
        // maxDownloads never changes after the token is issued, so the observed value is safe.
        [`${path}.downloadCount`]: { $lt: state.record.maxDownloads },
      },
      { $inc: { [`${path}.downloadCount`]: 1 } },
      { new: true }
    );

    if (updated) {
      const record = updated.downloadTokens[state.index];
      return {
        order: updated,
        index: state.index,
        record,
        remaining: Math.max(0, record.maxDownloads - record.downloadCount),
      };
    }
    // Lost the race (limit reached / refunded / revoked meanwhile): loop re-reads and reports why.
  }
  return fail(409, "Download is busy, please retry");
}

/** Gives back a download that was consumed but could not be delivered. */
async function releaseDownload(orderId, index) {
  const path = `downloadTokens.${index}.downloadCount`;
  await DigitalOrder.updateOne({ _id: orderId, [path]: { $gt: 0 } }, { $inc: { [path]: -1 } });
}

/**
 * Atomically records a sale: enforces the coupon usage limit and bumps totalSales,
 * totalRevenue and the coupon's timesUsed in one conditional update.
 * @returns {Promise<{error}|{product, couponResult, couponId}>}
 */
async function reserveSale(productId, couponCode) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const product = await DigitalProduct.findById(productId);
    if (!product || product.status !== "active") return fail(404, "Active product not found");

    const couponResult = product.applyCoupon(couponCode);
    if (couponResult.error) return fail(400, couponResult.error);

    const filter = { _id: product._id, status: "active", price: product.price };
    const inc = { totalSales: 1, totalRevenue: couponResult.finalPrice };
    let couponId = null;

    if (couponResult.coupon) {
      couponId = couponResult.coupon._id;
      const index = product.coupons.findIndex((c) => String(c._id) === String(couponId));
      const path = `coupons.${index}`;
      filter[`${path}._id`] = couponId;
      filter[`${path}.active`] = true;
      if (couponResult.coupon.usageLimit) {
        filter[`${path}.timesUsed`] = { $lt: couponResult.coupon.usageLimit };
      }
      inc[`${path}.timesUsed`] = 1;
    }

    const updated = await DigitalProduct.findOneAndUpdate(filter, { $inc: inc }, { new: true });
    if (updated) return { product: updated, couponResult, couponId };
    // Coupon exhausted / edited / product changed meanwhile: re-read and re-evaluate.
  }
  return fail(409, "Checkout is busy, please retry");
}

/** Compensates reserveSale() when the order could not be persisted. */
async function releaseSale(productId, finalPrice, couponId) {
  await DigitalProduct.updateOne(
    { _id: productId },
    { $inc: { totalSales: -1, totalRevenue: -finalPrice } }
  );
  if (couponId) {
    const product = await DigitalProduct.findById(productId);
    const index = product ? product.coupons.findIndex((c) => String(c._id) === String(couponId)) : -1;
    if (index !== -1) {
      const path = `coupons.${index}`;
      await DigitalProduct.updateOne(
        { _id: productId, [`${path}._id`]: couponId, [`${path}.timesUsed`]: { $gt: 0 } },
        { $inc: { [`${path}.timesUsed`]: -1 } }
      );
    }
  }
}

/**
 * Refunds an order exactly once. The status flip is a conditional update, so two concurrent
 * refund requests cannot both succeed (which used to deduct the revenue twice).
 * @returns {Promise<{error}|{order}>}
 */
async function refundOrderOnce(orderId, creatorId) {
  const order = await DigitalOrder.findOne({ _id: orderId, creatorId });
  if (!order) return fail(404, "Order not found or unauthorized");
  if (order.orderStatus === "refunded") return fail(400, "Order already refunded");

  const set = { orderStatus: "refunded" };
  order.downloadTokens.forEach((_, i) => {
    set[`downloadTokens.${i}.revoked`] = true;
  });

  const refunded = await DigitalOrder.findOneAndUpdate(
    { _id: order._id, creatorId, orderStatus: { $ne: "refunded" } },
    { $set: set },
    { new: true }
  );
  if (!refunded) return fail(400, "Order already refunded");

  // Atomic revenue adjustment that keeps the original "never below zero" floor.
  const amount = order.amountPaid;
  const adjusted = await DigitalProduct.updateOne(
    { _id: order.productId, totalRevenue: { $gte: amount } },
    { $inc: { totalRevenue: -amount } }
  );
  if (adjusted.modifiedCount === 0) {
    await DigitalProduct.updateOne(
      { _id: order.productId, totalRevenue: { $lt: amount } },
      { $set: { totalRevenue: 0 } }
    );
  }

  return { order: refunded };
}

/** Strips secrets from a product before it is shown to anyone but its owner. */
function toPublicProduct(product) {
  const plain = typeof product.toObject === "function" ? product.toObject() : { ...product };
  delete plain.fileUrl; // direct file link: would bypass tokens, expiry and download limits
  delete plain.coupons; // discount codes are secrets
  delete plain.totalRevenue; // private business metric
  return plain;
}

function isProductOwner(user, product) {
  if (!user) return false;
  const userId = user._id || user.id || user;
  return Boolean(userId) && String(product.creatorId) === String(userId);
}

module.exports = {
  evaluateToken,
  consumeDownloadToken,
  releaseDownload,
  reserveSale,
  releaseSale,
  refundOrderOnce,
  toPublicProduct,
  isProductOwner,
};
