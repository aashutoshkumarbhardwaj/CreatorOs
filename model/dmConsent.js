const mongoose = require("mongoose");

const consentHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["opt_in", "opt_out"],
      required: true,
    },
    keyword: {
      type: String,
      trim: true,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const dmConsentSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["instagram", "twitter"],
      default: "instagram",
      required: true,
    },
    recipientId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["opted_in", "opted_out"],
      default: "opted_in",
      required: true,
      index: true,
    },
    optedOutAt: {
      type: Date,
      default: null,
    },
    optedInAt: {
      type: Date,
      default: Date.now,
    },
    lastOptOutKeyword: {
      type: String,
      trim: true,
      default: null,
    },
    history: [consentHistorySchema],
  },
  { timestamps: true }
);

// Unique compound index: one consent document per creator + platform + recipient
dmConsentSchema.index(
  { creatorId: 1, platform: 1, recipientId: 1 },
  { unique: true }
);

// Lookup index for creator suppression list queries
dmConsentSchema.index({ creatorId: 1, status: 1 });

module.exports =
  mongoose.models.DmConsent || mongoose.model("DmConsent", dmConsentSchema);
