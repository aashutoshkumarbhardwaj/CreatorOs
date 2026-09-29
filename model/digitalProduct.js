const mongoose = require("mongoose");
const crypto = require("crypto");

const downloadTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    index: true,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  maxDownloads: {
    type: Number,
    default: 5,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  revoked: {
    type: Boolean,
    default: false,
  },
});

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  discountPercent: {
    type: Number,
    min: 1,
    max: 100,
    required: true,
  },
  expiresAt: {
    type: Date,
  },
  usageLimit: {
    type: Number,
    default: null,
  },
  timesUsed: {
    type: Number,
    default: 0,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

const digitalProductSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: ["preset", "ebook", "template", "audio", "course", "bundle", "other"],
      default: "other",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    previewUrls: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    maxDownloadsPerPurchase: {
      type: Number,
      default: 5,
    },
    tokenExpiryHours: {
      type: Number,
      default: 48,
    },
    coupons: [couponSchema],
    totalSales: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

digitalProductSchema.index({ creatorId: 1, slug: 1 }, { unique: true });

const digitalOrderSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DigitalProduct",
      required: true,
      index: true,
    },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    customerName: {
      type: String,
      default: "Valued Customer",
      trim: true,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    appliedCoupon: {
      type: String,
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    paymentProvider: {
      type: String,
      enum: ["stripe", "paypal", "mock"],
      default: "mock",
    },
    paymentId: {
      type: String,
      required: true,
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ["completed", "refunded", "disputed"],
      default: "completed",
    },
    downloadTokens: [downloadTokenSchema],
  },
  {
    timestamps: true,
  }
);

digitalProductSchema.methods.applyCoupon = function (code) {
  if (!code) return { finalPrice: this.price, discount: 0 };
  const upper = code.trim().toUpperCase();
  const coupon = this.coupons.find(
    (c) => c.code === upper && c.active && (!c.expiresAt || c.expiresAt > new Date())
  );
  if (!coupon) {
    return { finalPrice: this.price, discount: 0, error: "Invalid or expired coupon" };
  }
  if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
    return { finalPrice: this.price, discount: 0, error: "Coupon usage limit reached" };
  }
  const discount = Number(((this.price * coupon.discountPercent) / 100).toFixed(2));
  const finalPrice = Math.max(0, Number((this.price - discount).toFixed(2)));
  return { finalPrice, discount, coupon };
};

digitalProductSchema.methods.generateDownloadToken = function (maxDownloads = null) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiryHours = this.tokenExpiryHours || 48;
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  return {
    token,
    downloadCount: 0,
    maxDownloads: maxDownloads || this.maxDownloadsPerPurchase || 5,
    expiresAt,
    revoked: false,
  };
};

const DigitalProduct = mongoose.model("DigitalProduct", digitalProductSchema);
const DigitalOrder = mongoose.model("DigitalOrder", digitalOrderSchema);

module.exports = {
  DigitalProduct,
  DigitalOrder,
};
