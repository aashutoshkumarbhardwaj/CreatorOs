const mongoose = require("mongoose");

/**
 * @schema scheduledContentSchema
 * @description Content a creator has written ahead of time and scheduled to
 * auto-publish at a future date/time. scheduledAt is always stored in UTC -
 * the timezone field is kept only so the UI can redisplay the originally
 * chosen local time; the publish worker always compares against UTC "now",
 * so DST transitions in the creator's timezone can't cause an off-by-one-
 * hour publish.
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
            enum: ["scheduled", "published", "cancelled"],
            default: "scheduled",
        },
        publishedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

scheduledContentSchema.index({ status: 1, scheduledAt: 1 });

const ScheduledContentModel =
    mongoose.models.ScheduledContent || mongoose.model("ScheduledContent", scheduledContentSchema);
module.exports = ScheduledContentModel;
