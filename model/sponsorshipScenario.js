const mongoose = require("mongoose");

const scenarioDeliverableSchema = new mongoose.Schema(
  {
    rateCardDeliverableId: { type: mongoose.Schema.Types.ObjectId, default: null },
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
    basePrice: { type: Number, required: true, min: 0 },
    estimatedImpressions: { type: Number, default: 10000, min: 0 },
    turnaroundDays: { type: Number, default: 7, min: 0 },
    includesUsageRightsDays: { type: Number, default: 30, min: 0 },
    description: { type: String, trim: true, default: "", maxlength: 240 },
  },
  { _id: false },
);

const sponsorshipScenarioSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    inputs: {
      platform: {
        type: String,
        enum: ["youtube", "instagram", "tiktok", "twitter", "podcast", "newsletter"],
        required: true,
      },
      campaignDurationDays: { type: Number, required: true, min: 1, max: 365 },
      usageRightsOption: {
        type: String,
        enum: ["organic_only", "days_30", "days_90", "days_180", "days_365", "in_perpetuity"],
        required: true,
      },
      exclusivityOption: {
        type: String,
        enum: ["none", "days_30", "days_90", "days_180"],
        required: true,
      },
      whitelistingAllowed: { type: Boolean, default: false },
      rateCardId: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorRateCard", default: null },
      deliverableIds: [{ type: mongoose.Schema.Types.ObjectId }],
    },
    deliverables: { type: [scenarioDeliverableSchema], required: true },
    quote: { type: mongoose.Schema.Types.Mixed, required: true },
    assumptions: { type: mongoose.Schema.Types.Mixed, required: true },
    pricingRuleVersion: { type: String, required: true },
  },
  { timestamps: true },
);

sponsorshipScenarioSchema.index({ creatorId: 1, updatedAt: -1 });

module.exports =
  mongoose.models.SponsorshipScenario ||
  mongoose.model("SponsorshipScenario", sponsorshipScenarioSchema);