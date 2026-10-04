const { DigitalProduct, DigitalOrder } = require("../model/digitalProduct");
const crypto = require("crypto");

/**
 * Helper to slugify product titles safely
 */
function createSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Fields that must never reach anyone but the product's owner: the file URL is
 * the paid asset itself (handing it out bypasses the whole token/refund flow)
 * and the coupon list contains every discount code with its limits.
 */
const OWNER_ONLY_FIELDS = ["fileUrl", "coupons"];

function viewerIdOf(req) {
  if (!req || !req.user) return null;
  return req.user._id ? String(req.user._id) : String(req.user);
}

function isProductOwner(req, product) {
  const viewerId = viewerIdOf(req);
  return Boolean(viewerId) && String(product.creatorId) === viewerId;
}

function toPublicProduct(product) {
  const plain = typeof product.toObject === "function" ? product.toObject() : { ...product };
  OWNER_ONLY_FIELDS.forEach((field) => delete plain[field]);
  return plain;
}

/**
 * Create a new digital product
 */
exports.createProduct = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    if (!creatorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      title,
      description,
      category,
      price,
      currency,
      fileUrl,
      fileSize,
      previewUrls,
      status,
      maxDownloadsPerPurchase,
      tokenExpiryHours,
      coupons,
    } = req.body;

    if (!title || price === undefined || !fileUrl) {
      return res.status(400).json({
        success: false,
        message: "Title, price, and fileUrl are required fields.",
      });
    }

    let baseSlug = createSlug(title) || "digital-product";
    let slug = baseSlug;
    let counter = 1;
    while (await DigitalProduct.findOne({ creatorId, slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const product = new DigitalProduct({
      creatorId,
      title,
      slug,
      description,
      category: category || "other",
      price: Number(price),
      currency: currency || "USD",
      fileUrl,
      fileSize: fileSize || 0,
      previewUrls: previewUrls || [],
      status: status || "draft",
      maxDownloadsPerPurchase: maxDownloadsPerPurchase || 5,
      tokenExpiryHours: tokenExpiryHours || 48,
      coupons: coupons || [],
    });

    await product.save();

    return res.status(201).json({
      success: true,
      message: "Digital product created successfully",
      product,
    });
  } catch (error) {
    console.error("Error creating digital product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create digital product",
      error: error.message,
    });
  }
};

/**
 * List products for creator or public storefront
 */
exports.getProducts = async (req, res) => {
  try {
    const { creatorId, status, category, page = 1, limit = 20 } = req.query;
    const query = {};
    const viewerId = viewerIdOf(req);

    if (creatorId) {
      query.creatorId = creatorId;
    } else if (viewerId) {
      query.creatorId = viewerId;
    }

    // Only a creator looking at their own catalogue may see drafts/archived
    // items, choose a status filter, or receive owner-only fields. Everyone else
    // gets active products only, whatever ?status= they ask for.
    const isOwnerView = Boolean(viewerId) && String(query.creatorId) === viewerId;

    if (isOwnerView) {
      if (status) {
        query.status = status;
      }
    } else {
      query.status = "active";
    }

    if (category) {
      query.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    let listing = DigitalProduct.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    if (!isOwnerView) {
      listing = listing.select(OWNER_ONLY_FIELDS.map((field) => `-${field}`).join(" "));
    }

    const [found, total] = await Promise.all([listing, DigitalProduct.countDocuments(query)]);
    // Defence in depth: besides not selecting the fields, strip them from every
    // item so a schema default (e.g. `coupons: []`) can never reappear for non-owners.
    const products = isOwnerView ? found : found.map(toPublicProduct);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      products,
    });
  } catch (error) {
    console.error("Error listing digital products:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve products",
      error: error.message,
    });
  }
};

/**
 * Get product details by ID or Slug
 */
exports.getProductDetails = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let product;

    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      product = await DigitalProduct.findById(idOrSlug);
    } else {
      product = await DigitalProduct.findOne({ slug: idOrSlug.toLowerCase() });
    }

    const owner = product ? isProductOwner(req, product) : false;

    // Non-owners cannot see (or even confirm the existence of) unpublished products.
    if (!product || (!owner && product.status !== "active")) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({
      success: true,
      product: owner ? product : toPublicProduct(product),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message,
    });
  }
};

/**
 * Update a digital product (creator only)
 */
exports.updateProduct = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const product = await DigitalProduct.findOne({ _id: id, creatorId });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found or unauthorized" });
    }

    const allowedUpdates = [
      "title",
      "description",
      "category",
      "price",
      "currency",
      "fileUrl",
      "fileSize",
      "previewUrls",
      "status",
      "maxDownloadsPerPurchase",
      "tokenExpiryHours",
      "coupons",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    if (req.body.title && req.body.title !== product.title) {
      product.slug = createSlug(req.body.title);
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};

/**
 * Delete a product
 */
exports.deleteProduct = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const product = await DigitalProduct.findOneAndDelete({ _id: id, creatorId });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found or unauthorized" });
    }

    return res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

/**
 * Atomically claim one use of a coupon.
 *
 * `applyCoupon` only reads the in-memory product, so with parallel checkouts every
 * request sees the same `timesUsed` and the limit is exceeded. The check and the
 * increment must be a single conditional write: the filter only matches while the
 * coupon is still active, unexpired and below its limit.
 */
async function claimCouponUse(productId, coupon) {
  const match = {
    code: coupon.code,
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };

  if (coupon.usageLimit) {
    match.usageLimit = coupon.usageLimit;
    match.timesUsed = { $lt: coupon.usageLimit };
  }

  const claimed = await DigitalProduct.findOneAndUpdate(
    { _id: productId, status: "active", coupons: { $elemMatch: match } },
    { $inc: { "coupons.$.timesUsed": 1 } },
    { new: true }
  );

  return Boolean(claimed);
}

async function releaseCouponUse(productId, coupon) {
  try {
    await DigitalProduct.updateOne(
      { _id: productId, "coupons.code": coupon.code },
      { $inc: { "coupons.$.timesUsed": -1 } }
    );
  } catch (error) {
    console.error("Failed to release coupon use after a failed checkout:", error);
  }
}

/**
 * Purchase checkout simulation / order completion
 */
exports.createCheckoutOrder = async (req, res) => {
  try {
    const { productId, customerEmail, customerName, couponCode, paymentProvider = "mock" } = req.body;

    if (!productId || !customerEmail) {
      return res.status(400).json({
        success: false,
        message: "productId and customerEmail are required",
      });
    }

    const product = await DigitalProduct.findById(productId);
    if (!product || product.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Active product not found",
      });
    }

    const couponResult = product.applyCoupon(couponCode);
    if (couponResult.error) {
      return res.status(400).json({ success: false, message: couponResult.error });
    }

    // Claim the coupon use BEFORE creating the order so concurrent buyers cannot
    // all pass the usage-limit check against the same stale count.
    const coupon = couponResult.coupon;
    if (coupon && !(await claimCouponUse(product._id, coupon))) {
      return res.status(409).json({ success: false, message: "Coupon usage limit reached" });
    }

    const downloadToken = product.generateDownloadToken();
    const paymentId = `pay_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    const order = new DigitalOrder({
      creatorId: product.creatorId,
      productId: product._id,
      customerEmail,
      customerName: customerName || "Customer",
      amountPaid: couponResult.finalPrice,
      currency: product.currency,
      appliedCoupon: coupon ? coupon.code : null,
      discountAmount: couponResult.discount,
      paymentProvider,
      paymentId,
      orderStatus: "completed",
      downloadTokens: [downloadToken],
    });

    try {
      await order.save();
    } catch (error) {
      if (coupon) {
        await releaseCouponUse(product._id, coupon);
      }
      throw error;
    }

    // Counters are incremented atomically. Saving the whole product document here
    // would overwrite concurrent sales/coupon updates with stale values, and a
    // failure at this point must not turn an already-created order into a 500.
    try {
      await DigitalProduct.updateOne(
        { _id: product._id },
        { $inc: { totalSales: 1, totalRevenue: couponResult.finalPrice } }
      );
    } catch (error) {
      console.error(`Order ${order._id} was created but product stats could not be updated:`, error);
    }

    return res.status(201).json({
      success: true,
      message: "Order completed successfully",
      orderId: order._id,
      paymentId,
      downloadToken: downloadToken.token,
      expiresAt: downloadToken.expiresAt,
      maxDownloads: downloadToken.maxDownloads,
      downloadUrl: `/api/store/download/${downloadToken.token}`,
    });
  } catch (error) {
    console.error("Checkout order error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process checkout",
      error: error.message,
    });
  }
};

/**
 * Why a download token cannot be used right now (null when it can).
 */
function describeDownloadDenial(order, token, now = new Date()) {
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
 * Validate and consume a secure download token
 */
exports.validateAndConsumeDownload = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const order = await DigitalOrder.findOne({ "downloadTokens.token": token });
    const denial = describeDownloadDenial(order, token);
    if (denial) {
      return res.status(denial.status).json({ success: false, message: denial.message });
    }

    const product = await DigitalProduct.findById(order.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Associated product file missing" });
    }

    // Consume one download with a single conditional write. Reading the counter,
    // checking it and saving the order lets parallel requests all pass the check
    // and overwrite each other's increment, so the limit (and a refund that lands
    // in between) is not enforced. The filter re-checks every condition at write time.
    const observed = order.downloadTokens.find((t) => t.token === token);
    const now = new Date();
    const consumed = await DigitalOrder.findOneAndUpdate(
      {
        _id: order._id,
        orderStatus: { $ne: "refunded" },
        downloadTokens: {
          $elemMatch: {
            token,
            revoked: false,
            expiresAt: { $gt: now },
            maxDownloads: observed.maxDownloads,
            downloadCount: { $lt: observed.maxDownloads },
          },
        },
      },
      { $inc: { "downloadTokens.$.downloadCount": 1 } },
      { new: true }
    );

    if (!consumed) {
      // Lost a race (another download used the last slot, or a refund/revoke landed).
      const latest = await DigitalOrder.findOne({ _id: order._id });
      const reason = describeDownloadDenial(latest, token) || {
        status: 409,
        message: "Download state changed, please try again",
      };
      return res.status(reason.status).json({ success: false, message: reason.message });
    }

    const tokenRecord = consumed.downloadTokens.find((t) => t.token === token);

    return res.status(200).json({
      success: true,
      message: "Download authorized",
      fileUrl: product.fileUrl,
      fileName: product.title,
      remainingDownloads: tokenRecord.maxDownloads - tokenRecord.downloadCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Download validation failed",
      error: error.message,
    });
  }
};

/**
 * Process a refund and revoke download tokens
 */
exports.refundOrder = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { orderId } = req.params;

    // Flip the order to "refunded" and revoke every token in ONE conditional write.
    // Exactly one concurrent request can win it, so revenue is adjusted once, and a
    // later whole-document save can no longer put a refunded order back to "completed".
    const order = await DigitalOrder.findOneAndUpdate(
      { _id: orderId, creatorId, orderStatus: { $ne: "refunded" } },
      { $set: { orderStatus: "refunded", "downloadTokens.$[].revoked": true } },
      { new: true }
    );

    if (!order) {
      const existing = await DigitalOrder.findOne({ _id: orderId, creatorId });
      if (!existing) {
        return res.status(404).json({ success: false, message: "Order not found or unauthorized" });
      }
      return res.status(400).json({ success: false, message: "Order already refunded" });
    }

    // Adjust product revenue atomically, never below zero.
    await DigitalProduct.updateOne({ _id: order.productId }, { $inc: { totalRevenue: -order.amountPaid } });
    await DigitalProduct.updateOne({ _id: order.productId, totalRevenue: { $lt: 0 } }, { $set: { totalRevenue: 0 } });

    return res.status(200).json({
      success: true,
      message: "Order refunded and download access revoked",
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error.message,
    });
  }
};

/**
 * Get sales and revenue report for creator
 */
exports.getSalesReport = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;

    const [products, orders] = await Promise.all([
      DigitalProduct.find({ creatorId }),
      DigitalOrder.find({ creatorId }),
    ]);

    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.orderStatus === "completed");
    const refundedOrders = orders.filter((o) => o.orderStatus === "refunded");

    const grossRevenue = completedOrders.reduce((sum, o) => sum + o.amountPaid, 0);
    const refundedAmount = refundedOrders.reduce((sum, o) => sum + o.amountPaid, 0);
    const netRevenue = Number((grossRevenue - refundedAmount).toFixed(2));

    return res.status(200).json({
      success: true,
      report: {
        totalProducts: products.length,
        totalOrders,
        completedCount: completedOrders.length,
        refundedCount: refundedOrders.length,
        grossRevenue: Number(grossRevenue.toFixed(2)),
        refundedAmount: Number(refundedAmount.toFixed(2)),
        netRevenue,
        productsSummary: products.map((p) => ({
          id: p._id,
          title: p.title,
          sales: p.totalSales,
          revenue: p.totalRevenue,
          status: p.status,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate sales report",
      error: error.message,
    });
  }
};
