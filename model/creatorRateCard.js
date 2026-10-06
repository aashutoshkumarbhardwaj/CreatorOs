const mongoose = require("mongoose");

const rateDeliverableSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ["youtube", "instagram", "tiktok", "twitter", "podcast", "newsletter"],
    required: true,
  },
  deliverableType: {
    type: String,
    enum: [
      "dedicated_video",
      "integrated_segment",
      "reel_or_short",
      "story_sequence",
      "feed_post",
      "thread",
      "newsletter_sponsorship",
    ],
    required: true,
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0,
  },
  estimatedImpressions: {
    type: Number,
    default: 10000,
  },
  turnaroundDays: {
    type: Number,
    default: 7,
  },
  includesUsageRightsDays: {
    type: Number,
    default: 30, // 30 days organic usage
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
});

const creatorRateCardSchema = new mongoose.Schema(
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
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    niche: {
      type: String,
      enum: ["tech", "finance", "business", "gaming", "lifestyle", "fitness", "beauty", "education", "other"],
      default: "tech",
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    deliverables: [rateDeliverableSchema],
    twoDeliverableBundleDiscountPercent: {
      type: Number,
      default: 10,
    },
    threePlusBundleDiscountPercent: {
      type: Number,
      default: 20,
    },
    agencyCommissionPercent: {
      type: Number,
      default: 0,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    contactEmail: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      default: "Rates are valid for 30 days from generation. 50% upfront payment required to hold calendar slot.",
    },
  },
  {
    timestamps: true,
  }
);

creatorRateCardSchema.index({ creatorId: 1, slug: 1 }, { unique: true });

const CreatorRateCard = mongoose.model("CreatorRateCard", creatorRateCardSchema);

module.exports = CreatorRateCard;
