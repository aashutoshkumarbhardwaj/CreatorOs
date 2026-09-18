const mongoose = require("mongoose");

const derivativeSchema = new mongoose.Schema({
  targetPlatform: {
    type: String,
    enum: ["youtube_shorts", "instagram_reels", "tiktok", "twitter_thread", "linkedin_carousel", "newsletter"],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  aspectRatio: {
    type: String,
    enum: ["9:16", "1:1", "16:9", "text"],
    default: "9:16",
  },
  assignedEditor: {
    type: String,
    trim: true,
    default: "Unassigned",
  },
  status: {
    type: String,
    enum: ["pending", "in_editing", "ready_for_review", "approved", "scheduled", "posted"],
    default: "pending",
  },
  scheduledPublishDate: {
    type: Date,
  },
});

const approvalLogSchema = new mongoose.Schema({
  stage: {
    type: String,
    required: true,
  },
  approvedBy: {
    type: String,
    required: true,
  },
  comments: {
    type: String,
    default: "",
  },
  approvedAt: {
    type: Date,
    default: Date.now,
  },
});

const contentRepurposeWorkflowSchema = new mongoose.Schema(
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
    primaryPlatform: {
      type: String,
      enum: ["youtube_longform", "podcast", "live_stream", "blog"],
      default: "youtube_longform",
    },
    primaryAssetUrl: {
      type: String,
      trim: true,
      default: "",
    },
    approvalStage: {
      type: String,
      enum: ["concept_pitch", "script_draft", "rough_cut", "final_review", "approved", "published"],
      default: "concept_pitch",
      index: true,
    },
    editorialChecklist: {
      audioNormalized: { type: Boolean, default: false },
      thumbnailApproved: { type: Boolean, default: false },
      sponsorCleared: { type: Boolean, default: false },
      closedCaptionsSynced: { type: Boolean, default: false },
    },
    approvalHistory: [approvalLogSchema],
    derivatives: [derivativeSchema],
    targetPublishDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

contentRepurposeWorkflowSchema.methods.isChecklistComplete = function () {
  const c = this.editorialChecklist;
  return c.audioNormalized && c.thumbnailApproved && c.sponsorCleared && c.closedCaptionsSynced;
};

const ContentRepurposeWorkflow = mongoose.model("ContentRepurposeWorkflow", contentRepurposeWorkflowSchema);

module.exports = ContentRepurposeWorkflow;
