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

    if (creatorId) {
      query.creatorId = creatorId;
    } else if (req.user && req.user._id) {
      query.creatorId = req.user._id;
    }

    if (status) {
      query.status = status;
    } else if (!req.user || (req.user._id && String(query.creatorId) !== String(req.user._id))) {
      query.status = "active";
    }

    if (category) {
      query.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      DigitalProduct.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      DigitalProduct.countDocuments(query),
    ]);

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

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({ success: true, product });
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

    const downloadToken = product.generateDownloadToken();
    const paymentId = `pay_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    const order = new DigitalOrder({
      creatorId: product.creatorId,
      productId: product._id,
      customerEmail,
      customerName: customerName || "Customer",
      amountPaid: couponResult.finalPrice,
      currency: product.currency,
      appliedCoupon: couponResult.coupon ? couponResult.coupon.code : null,
      discountAmount: couponResult.discount,
      paymentProvider,
      paymentId,
      orderStatus: "completed",
      downloadTokens: [downloadToken],
    });

    await order.save();

    // Update product stats
    product.totalSales += 1;
    product.totalRevenue += couponResult.finalPrice;
    if (couponResult.coupon) {
      couponResult.coupon.timesUsed += 1;
    }
    await product.save();

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
 * Validate and consume a secure download token
 */
exports.validateAndConsumeDownload = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const order = await DigitalOrder.findOne({ "downloadTokens.token": token });
    if (!order) {
      return res.status(404).json({ success: false, message: "Download token not found" });
    }

    if (order.orderStatus === "refunded") {
      return res.status(403).json({
        success: false,
        message: "Order has been refunded. Download access revoked.",
      });
    }

    const tokenRecord = order.downloadTokens.find((t) => t.token === token);
    if (!tokenRecord) {
      return res.status(404).json({ success: false, message: "Invalid download token" });
    }

    if (tokenRecord.revoked) {
      return res.status(403).json({ success: false, message: "Download token has been revoked" });
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      return res.status(410).json({ success: false, message: "Download link has expired" });
    }

    if (tokenRecord.downloadCount >= tokenRecord.maxDownloads) {
      return res.status(429).json({
        success: false,
        message: "Maximum download limit reached for this token",
      });
    }

    const product = await DigitalProduct.findById(order.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Associated product file missing" });
    }

    tokenRecord.downloadCount += 1;
    await order.save();

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

    const order = await DigitalOrder.findOne({ _id: orderId, creatorId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found or unauthorized" });
    }

    if (order.orderStatus === "refunded") {
      return res.status(400).json({ success: false, message: "Order already refunded" });
    }

    order.orderStatus = "refunded";
    order.downloadTokens.forEach((t) => {
      t.revoked = true;
    });

    await order.save();

    // Adjust product revenue
    const product = await DigitalProduct.findById(order.productId);
    if (product) {
      product.totalRevenue = Math.max(0, product.totalRevenue - order.amountPaid);
      await product.save();
    }

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
