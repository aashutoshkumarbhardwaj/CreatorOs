const mongoose = require("mongoose");

const deliverableItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  platform: {
    type: String,
    enum: ["youtube", "instagram", "tiktok", "twitter", "podcast", "newsletter"],
    required: true,
  },
  format: {
    type: String,
    enum: ["dedicated_video", "60s_integration", "reel", "story_set", "newsletter_banner", "post"],
    default: "60s_integration",
  },
  dueDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ["drafting", "submitted_for_review", "revision_requested", "approved_by_brand", "published"],
    default: "drafting",
  },
  livePostUrl: {
    type: String,
    trim: true,
    default: "",
  },
});

const paymentMilestoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true, // e.g., "50% upfront", "50% upon publication"
  },
  percentage: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "invoiced", "paid"],
    default: "pending",
  },
  paidAt: {
    type: Date,
  },
});

const crmDeliverableContractSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    campaignName: {
      type: String,
      required: true,
      trim: true,
    },
    totalContractValue: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    stage: {
      type: String,
      enum: ["lead", "pitch", "negotiation", "contract_signed", "in_production", "published", "paid", "lost"],
      default: "negotiation",
      index: true,
    },
    stageProbabilityPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    deliverables: [deliverableItemSchema],
    milestones: [paymentMilestoneSchema],
    expectedCloseDate: {
      type: Date,
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

const DEFAULT_STAGE_PROBABILITIES = {
  lead: 10,
  pitch: 25,
  negotiation: 50,
  contract_signed: 85,
  in_production: 95,
  published: 98,
  paid: 100,
  lost: 0,
};

crmDeliverableContractSchema.pre("save", function (next) {
  if (this.isModified("stage") && this.stage in DEFAULT_STAGE_PROBABILITIES) {
    this.stageProbabilityPercent = DEFAULT_STAGE_PROBABILITIES[this.stage];
  }
  this.lastActivityAt = new Date();
  next();
});

const CrmDeliverableContract = mongoose.model("CrmDeliverableContract", crmDeliverableContractSchema);

module.exports = {
  CrmDeliverableContract,
  DEFAULT_STAGE_PROBABILITIES,
};
