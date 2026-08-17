const mongoose = require("mongoose");

/**
 * @schema aiInsightSchema
 * @description Mongoose schema for personalized AI creator growth insights and prediction metrics.
 */
const aiInsightSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    niche: {
      type: String,
      default: "General Creator",
      trim: true,
    },
    growthInsights: [
      {
        category: {
          type: String,
          enum: ["content", "seo", "engagement", "schedule", "monetization"],
          required: true,
        },
        tip: {
          type: String,
          required: true,
        },
        impactScore: {
          type: Number,
          min: 1,
          max: 100,
          default: 85,
        },
        actionItem: {
          type: String,
          default: "",
        },
      },
    ],
    lastAnalyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

aiInsightSchema.index({ userId: 1, lastAnalyzedAt: -1 });

module.exports = mongoose.model("AiInsight", aiInsightSchema);
