const mongoose = require("mongoose");

/**
 * @schema scheduledContentSchema
 * @description Content a creator has written ahead of time and scheduled to
 * auto-publish at a future date/time.
 */
const scheduledContentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        caption: {
            type: String,
            required: true,
            trim: true,
        },
        mediaUrl: {
            type: String,
        },
        platform: {
            type: String,
            enum: ["instagram", "youtube", "twitter", "tiktok", "general"],
            default: "instagram",
        },
        platformPostId: {
            type: String,
            default: null,
        },
        errorMessage: {
            type: String,
            default: null,
        },
        timezone: {
            type: String,
            required: true,
        },
        scheduledAt: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ["scheduled", "publishing", "published", "failed", "cancelled"],
            default: "scheduled",
        },
        publishedAt: {
            type: Date,
        },
        publishedBy: {
            type: String,
        },
        publishingStartedAt: {
            type: Date,
            default: null,
        },
        publishAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

scheduledContentSchema.index({ status: 1, scheduledAt: 1 });
scheduledContentSchema.index({ status: 1, publishingStartedAt: 1 });

const ScheduledContentModel =
    mongoose.models.ScheduledContent || mongoose.model("ScheduledContent", scheduledContentSchema);
module.exports = ScheduledContentModel;
