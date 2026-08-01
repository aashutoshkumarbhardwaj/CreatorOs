const mongoose = require("mongoose");

/**
 * @schema notificationPreferenceSchema
 * @description Stores creator preferences for channels, categories, quiet hours, intelligent scheduling, and deduplication.
 */
const notificationPreferenceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        channels: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            push: { type: Boolean, default: true },
            inApp: { type: Boolean, default: true },
        },
        categories: {
            system: { type: Boolean, default: true },
            engagement: { type: Boolean, default: true },
            content: { type: Boolean, default: true },
            analytics: { type: Boolean, default: true },
            marketing: { type: Boolean, default: false },
        },
        quietHours: {
            enabled: { type: Boolean, default: false },
            startTime: { type: String, default: "22:00" }, // 24hr HH:mm format
            endTime: { type: String, default: "08:00" },   // 24hr HH:mm format
            timezone: { type: String, default: "UTC" },
        },
        intelligentScheduling: {
            enabled: { type: Boolean, default: true },
            preferredWindow: {
                type: String,
                enum: ["optimal", "morning", "afternoon", "evening"],
                default: "optimal",
            },
        },
        deduplication: {
            enabled: { type: Boolean, default: true },
            windowMinutes: { type: Number, default: 15, min: 1, max: 1440 },
        },
    },
    { timestamps: true }
);

const NotificationPreferenceModel =
    mongoose.models.NotificationPreference ||
    mongoose.model("NotificationPreference", notificationPreferenceSchema);

module.exports = NotificationPreferenceModel;
