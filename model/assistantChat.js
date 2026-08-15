const mongoose = require("mongoose");

/**
 * @schema assistantChatSchema
 * @description Mongoose schema for persistent AI Creator Assistant conversation threads.
 */
const assistantChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
      trim: true,
      maxlength: 120,
    },
    platform: {
      type: String,
      enum: ["general", "instagram", "youtube", "twitter", "tiktok", "linkedin"],
      default: "general",
    },
    tone: {
      type: String,
      enum: ["energetic", "professional", "witty", "persuasive", "minimalist", "educational"],
      default: "energetic",
    },
    messages: [
      {
        messageId: {
          type: String,
          required: true,
        },
        role: {
          type: String,
          enum: ["user", "assistant", "system"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        structuredData: {
          suggestions: [String],
          seoScore: Number,
          viralityScore: Number,
          keywords: [String],
          hashtags: [String],
          ctas: [String],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

assistantChatSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("AssistantChat", assistantChatSchema);
