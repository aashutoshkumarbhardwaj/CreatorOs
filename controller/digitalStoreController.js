const { DigitalProduct, DigitalOrder } = require("../model/digitalProduct");
const crypto = require("crypto");
const store = require("../services/digitalStoreService");

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

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePage(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE;
  return parsed;
}

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

/**
 * List products for creator or public storefront
 */
exports.getProducts = async (req, res) => {
  try {
    const { creatorId, status, category } = req.query;
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
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

    const skip = (page - 1) * limit;
    const [foundProducts, total] = await Promise.all([
      DigitalProduct.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DigitalProduct.countDocuments(query),
    ]);

    // Only the owning creator may see fileUrl / coupons / revenue; everyone else gets a safe view.
    const products = foundProducts.map((p) => (store.isProductOwner(req.user, p) ? p : store.toPublicProduct(p)));

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit),
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
    const isPublic = req.route?.path?.includes("/public/") || !req.user;
    const query = {};

    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = idOrSlug;
    } else {
      query.slug = idOrSlug.toLowerCase();
    }

    if (isPublic) {
      query.status = "active";
    }

    const product = await DigitalProduct.findOne(query);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (!store.isProductOwner(req.user, product)) {
      // Authenticated non-owners must not see drafts/archived products or secrets either.
      if (product.status !== "active") {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      return res.status(200).json({ success: true, product: store.toPublicProduct(product) });
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

    // Coupon limit check + sales/revenue/coupon counters are one atomic update (no lost updates,
    // no coupon over-redemption under concurrent checkouts).
    const sale = await store.reserveSale(productId, couponCode);
    if (sale.error) {
      return res.status(sale.error.status).json({ success: false, message: sale.error.message });
    }

    const { product, couponResult, couponId } = sale;
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

    try {
      await order.save();
    } catch (saveError) {
      // The sale was already counted: undo it so stats/coupons never drift from real orders.
      await store.releaseSale(product._id, couponResult.finalPrice, couponId);
      throw saveError;
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
 * Validate and consume a secure download token
 */
exports.validateAndConsumeDownload = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    // Validation and the download counter increment are one atomic conditional update, so the
    // per-token limit cannot be exceeded by parallel requests and refunds take effect immediately.
    const consumed = await store.consumeDownloadToken(token);
    if (consumed.error) {
      return res.status(consumed.error.status).json({ success: false, message: consumed.error.message });
    }

    const product = await DigitalProduct.findById(consumed.order.productId);
    if (!product) {
      await store.releaseDownload(consumed.order._id, consumed.index);
      return res.status(404).json({ success: false, message: "Associated product file missing" });
    }

    return res.status(200).json({
      success: true,
      message: "Download authorized",
      fileUrl: product.fileUrl,
      fileName: product.title,
      remainingDownloads: consumed.remaining,
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

    const result = await store.refundOrderOnce(orderId, creatorId);
    if (result.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }
    const order = result.order;

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
