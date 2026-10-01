const mongoose = require("mongoose");

const retentionMilestonesSchema = new mongoose.Schema({
  day7Retention: { type: Number, default: 0 },
  day14Retention: { type: Number, default: 0 },
  day30Retention: { type: Number, default: 0 },
  day60Retention: { type: Number, default: 0 },
});

const platformMetricsSchema = new mongoose.Schema({
  youtubeViews: { type: Number, default: 0 },
  youtubeWatchHours: { type: Number, default: 0 },
  instagramImpressions: { type: Number, default: 0 },
  instagramEngagementRate: { type: Number, default: 0 },
  tiktokViews: { type: Number, default: 0 },
  smartBioClicks: { type: Number, default: 0 },
  storeGrossRevenue: { type: Number, default: 0 },
});

const analyticsCohortSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cohortMonth: {
      type: String, // Format: YYYY-MM
      required: true,
      index: true,
    },
    newFollowersAcquired: {
      type: Number,
      required: true,
      default: 0,
    },
    retention: retentionMilestonesSchema,
    metrics: platformMetricsSchema,
    compositeHealthScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    anomalyFlag: {
      type: Boolean,
      default: false,
    },
    anomalyNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

analyticsCohortSchema.index({ creatorId: 1, cohortMonth: 1 }, { unique: true });

const AnalyticsCohort = mongoose.model("AnalyticsCohort", analyticsCohortSchema);

module.exports = AnalyticsCohort;
