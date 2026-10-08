const mongoose = require("mongoose");
const crypto = require("crypto");

const audienceSubscriberSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    firstName: {
      type: String,
      trim: true,
      default: "",
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    status: {
      type: String,
      enum: ["subscribed", "unsubscribed", "bounced", "complained"],
      default: "subscribed",
      index: true,
    },
    source: {
      type: String,
      enum: ["smart_bio", "store_checkout", "csv_import", "api", "manual"],
      default: "manual",
    },
    engagementScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    unsubscribeToken: {
      type: String,
      unique: true,
      index: true,
    },
    totalCampaignsReceived: {
      type: Number,
      default: 0,
    },
    totalOpens: {
      type: Number,
      default: 0,
    },
    totalClicks: {
      type: Number,
      default: 0,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

audienceSubscriberSchema.index({ creatorId: 1, email: 1 }, { unique: true });

audienceSubscriberSchema.pre("save", function (next) {
  if (!this.unsubscribeToken) {
    this.unsubscribeToken = crypto.randomBytes(24).toString("hex");
  }
  next();
});

audienceSubscriberSchema.methods.updateEngagement = function (action) {
  if (action === "open") {
    this.totalOpens += 1;
    this.engagementScore = Math.min(100, this.engagementScore + 5);
  } else if (action === "click") {
    this.totalClicks += 1;
    this.engagementScore = Math.min(100, this.engagementScore + 10);
  } else if (action === "bounce") {
    this.status = "bounced";
    this.engagementScore = 0;
  }
  this.lastActivityAt = new Date();
};

const AudienceSubscriber = mongoose.model("AudienceSubscriber", audienceSubscriberSchema);

module.exports = AudienceSubscriber;
