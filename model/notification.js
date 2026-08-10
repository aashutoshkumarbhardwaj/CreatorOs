const mongoose = require("mongoose");

/**
 * @schema notificationSchema
 * @description Notification record for user history, status tracking, multi-channel delivery, and engagement analytics.
 */
const notificationSchema = new mongoose.Schema(
    {
        userId: {
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
        message: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            enum: ["system", "engagement", "content", "analytics", "marketing"],
            default: "system",
            index: true,
        },
        priority: {
            type: String,
            enum: ["low", "normal", "high", "urgent"],
            default: "normal",
        },
        channels: [
            {
                type: String,
                enum: ["in_app", "email", "sms", "push"],
            },
        ],
        status: {
            type: String,
            enum: ["pending", "scheduled", "sent", "delivered", "read", "archived", "suppressed"],
            default: "pending",
            index: true,
        },
        scheduledFor: {
            type: Date,
            default: Date.now,
        },
        sentAt: {
            type: Date,
        },
        readAt: {
            type: Date,
        },
        archivedAt: {
            type: Date,
        },
        deduplicationKey: {
            type: String,
            index: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        deliveryLogs: [
            {
                channel: { type: String, enum: ["in_app", "email", "sms", "push"] },
                status: { type: String, enum: ["success", "failed", "delayed", "skipped"] },
                timestamp: { type: Date, default: Date.now },
                error: { type: String },
            },
        ],
        engagement: {
            opened: { type: Boolean, default: false },
            clicked: { type: Boolean, default: false },
            readAt: { type: Date },
            clickedAt: { type: Date },
        },
    },
    { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, deduplicationKey: 1, createdAt: -1 });

const NotificationModel =
    mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

module.exports = NotificationModel;
