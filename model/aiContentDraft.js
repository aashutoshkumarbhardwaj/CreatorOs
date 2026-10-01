const mongoose = require("mongoose");

const platformVariantSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ["instagram", "youtube", "tiktok", "twitter", "linkedin", "general"],
    required: true,
  },
  caption: {
    type: String,
    required: true,
  },
  characterCount: {
    type: Number,
    required: true,
  },
  hashtags: [
    {
      type: String,
    },
  ],
  callToAction: {
    type: String,
    default: "",
  },
});

const aiContentDraftSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    niche: {
      type: String,
      default: "general",
      trim: true,
    },
    tone: {
      type: String,
      enum: ["informative", "storytelling", "provocative", "humorous", "inspirational", "direct"],
      default: "informative",
    },
    hooks: [
      {
        style: String,
        text: String,
      },
    ],
    scriptOutline: {
      hook: String,
      retentionBuffer: String,
      mainPoints: [String],
      climax: String,
      callToAction: String,
    },
    platformVariants: [platformVariantSchema],
    analyzedHashtags: [
      {
        tag: String,
        tier: { type: String, enum: ["high", "medium", "niche"] },
        estimatedReachScore: Number,
      },
    ],
    isFavorite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const AiContentDraft = mongoose.model("AiContentDraft", aiContentDraftSchema);

module.exports = AiContentDraft;
