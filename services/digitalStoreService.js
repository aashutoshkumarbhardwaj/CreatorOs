const { DigitalProduct, DigitalOrder } = require("../model/digitalProduct");

/**
 * Atomic state transitions for the digital store.
 *
 * Every function below is a single-document conditional update, so MongoDB
 * evaluates the guard and applies the change in one step. The checkout,
 * download and refund handlers used to read a document, check a condition in
 * JavaScript and write it back with `save()`. Concurrent requests all passed the
 * same stale check, which allowed coupons to be over-redeemed, download limits
 * to be bypassed and refunds to be applied twice.
 */

/**
 * Atomically reserve one redemption of a coupon.
 * The usage limit and expiry are re-checked by the database at write time.
 * @returns {Promise<boolean>} true when the redemption was reserved
 */
async function reserveCouponRedemption(productId, coupon, now = new Date()) {
    const guard = { _id: coupon._id, active: true };
    if (coupon.usageLimit) {
        guard.timesUsed = { $lt: coupon.usageLimit };
    }
    if (coupon.expiresAt) {
        guard.expiresAt = { $gt: now };
    }

    const result = await DigitalProduct.updateOne(
        { _id: productId, status: "active", coupons: { $elemMatch: guard } },
        { $inc: { "coupons.$.timesUsed": 1 } }
    );

    return result.modifiedCount === 1;
}

/**
 * Give back a reserved coupon redemption (used when the order could not be created).
 */
async function releaseCouponRedemption(productId, coupon) {
    await DigitalProduct.updateOne(
        { _id: productId, coupons: { $elemMatch: { _id: coupon._id, timesUsed: { $gt: 0 } } } },
        { $inc: { "coupons.$.timesUsed": -1 } }
    );
}

/**
 * Record a completed sale without overwriting concurrent updates.
 */
async function recordSale(productId, amountPaid) {
    await DigitalProduct.updateOne(
        { _id: productId },
        { $inc: { totalSales: 1, totalRevenue: amountPaid } }
    );
}

/**
 * Remove refunded revenue from a product, never dropping below zero.
 */
async function reverseSaleRevenue(productId, amountPaid) {
    const result = await DigitalProduct.updateOne(
        { _id: productId, totalRevenue: { $gte: amountPaid } },
        { $inc: { totalRevenue: -amountPaid } }
    );

    if (result.matchedCount === 0) {
        await DigitalProduct.updateOne({ _id: productId }, { $set: { totalRevenue: 0 } });
    }
}

/**
 * Work out why a download token cannot be used right now.
 * @returns {{status: number, message: string}|null} null when the token is usable
 */
function evaluateDownloadAccess(order, token, now = new Date()) {
    if (!order) {
        return { status: 404, message: "Download token not found" };
    }

    if (order.orderStatus === "refunded") {
        return { status: 403, message: "Order has been refunded. Download access revoked." };
    }

    const tokenRecord = order.downloadTokens.find((t) => t.token === token);
    if (!tokenRecord) {
        return { status: 404, message: "Invalid download token" };
    }

    if (tokenRecord.revoked) {
        return { status: 403, message: "Download token has been revoked" };
    }

    if (now > new Date(tokenRecord.expiresAt)) {
        return { status: 410, message: "Download link has expired" };
    }

    if (tokenRecord.downloadCount >= tokenRecord.maxDownloads) {
        return { status: 429, message: "Maximum download limit reached for this token" };
    }

    return null;
}

/**
 * Atomically consume one download from a token. The limit, revocation, expiry and
 * refund state are all re-checked by the database at write time.
 * @returns {Promise<object|null>} the updated order, or null when the token can no longer be used
 */
async function consumeDownload(orderId, tokenRecord, now = new Date()) {
    return DigitalOrder.findOneAndUpdate(
        {
            _id: orderId,
            orderStatus: { $ne: "refunded" },
            downloadTokens: {
                $elemMatch: {
                    token: tokenRecord.token,
                    revoked: false,
                    expiresAt: { $gt: now },
                    downloadCount: { $lt: tokenRecord.maxDownloads },
                },
            },
        },
        { $inc: { "downloadTokens.$.downloadCount": 1 } },
        { new: true }
    );
}

/**
 * Atomically move an order to `refunded` and revoke all of its tokens. Only one caller can win.
 * @returns {Promise<object|null>} the refunded order, or null if it was missing or already refunded
 */
async function claimRefund(orderId, creatorId) {
    return DigitalOrder.findOneAndUpdate(
        { _id: orderId, creatorId, orderStatus: { $ne: "refunded" } },
        { $set: { orderStatus: "refunded", "downloadTokens.$[].revoked": true } },
        { new: true }
    );
}

/**
 * Merge coupons sent by a creator with the stored ones. `timesUsed` is server-owned: a
 * client edit must never reset (or inflate) how often a coupon has been redeemed.
 */
function mergeCouponsPreservingUsage(existingCoupons, incomingCoupons) {
    if (!Array.isArray(incomingCoupons)) return incomingCoupons;

    return incomingCoupons.map((incoming) => {
        if (!incoming || typeof incoming !== "object") return incoming;

        const code = typeof incoming.code === "string" ? incoming.code.trim().toUpperCase() : null;
        const previous = (existingCoupons || []).find(
            (existing) =>
                (incoming._id && String(existing._id) === String(incoming._id)) ||
                (code && existing.code === code)
        );

        const { timesUsed: _ignored, ...editable } = incoming;
        return previous
            ? { ...editable, _id: previous._id, timesUsed: previous.timesUsed }
            : { ...editable, timesUsed: 0 };
    });
}

module.exports = {
    reserveCouponRedemption,
    releaseCouponRedemption,
    recordSale,
    reverseSaleRevenue,
    evaluateDownloadAccess,
    consumeDownload,
    claimRefund,
    mergeCouponsPreservingUsage,
};
