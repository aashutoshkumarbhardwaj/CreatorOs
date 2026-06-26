const mongoose = require("mongoose");

/**
 * @schema urlSchema
 * @description Mongoose schema definition for url.
 */
const urlSchema = new mongoose.Schema({
    shortId: {
        type: String,
        required: true,
        unique: true,
    },
    redirectUrl: {
        type: String,
        required: true,
    },
    campaignName: {
        type: String,
        default: "Untitled Campaign",
    },
    totalClicks: {
        type: Number,
        default: 0,
    },
    qrFgColor: {
        type: String,
        default: "#1a1a1a",
    },
    qrBgColor: {
        type: String,
        default: "#ffffff",
    },
    qrGenerated: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    visitHistory: [
        {
            timestamp: {
                type: Date,
                default: Date.now,
            },
            source: {
                type: String,
                enum: ["qr", "direct", "unknown"],
                default: "unknown",
            },
        },
    ],
});

module.exports = mongoose.models.Url || mongoose.model("Url", urlSchema);