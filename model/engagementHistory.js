const mongoose = require("mongoose");

/**
 * @schema engagementHistorySchema
 * @description Mongoose schema definition for engagementHistory.
 */
const engagementHistorySchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Creator",
            required: true,
        },
        snapshotId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AnalyticsSnapshot",
            required: true,
        },
        date: { type: Date, default: Date.now },
        followersGrowth: { type: Number, default: 0 },
        likesGrowth: { type: Number, default: 0 },
        commentsGrowth: { type: Number, default: 0 },
        engagementRateDelta: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const EngagementHistoryModel =
    mongoose.models.EngagementHistory ||
    mongoose.model("EngagementHistory", engagementHistorySchema);

module.exports = EngagementHistoryModel;