const mongoose = require("mongoose");

/**
 * @schema analyticsSnapshotSchema
 * @description Mongoose schema definition for analyticsSnapshot.
 */
const analyticsSnapshotSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Creator",
            required: true,
        },
        platform: {
            type: String,
            enum: ["instagram", "youtube", "twitter", "tiktok"],
            required: true,
        },
        followers: { type: Number, default: 0 },
        following: { type: Number, default: 0 },
        totalPosts: { type: Number, default: 0 },
        totalLikes: { type: Number, default: 0 },
        totalComments: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 },
        engagementRate: { type: Number, default: 0 },
        snapshotDate: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

const AnalyticsSnapshotModel =
    mongoose.models.AnalyticsSnapshot ||
    mongoose.model("AnalyticsSnapshot", analyticsSnapshotSchema);

module.exports = AnalyticsSnapshotModel;