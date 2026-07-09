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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
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

/**
 * @swagger
 * components:
 *   schemas:
 *     Url:
 *       type: object
 *       required:
 *         - shortId
 *         - redirectUrl
 *       properties:
 *         shortId:
 *           type: string
 *         redirectUrl:
 *           type: string
 *         campaignName:
 *           type: string
 *         userId:
 *           type: string
 *         totalClicks:
 *           type: integer
 *         qrFgColor:
 *           type: string
 *         qrBgColor:
 *           type: string
 *         qrGenerated:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         visitHistory:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               source:
 *                 type: string
 */
urlSchema.statics.listForUser = async function (userId, limit = 100) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

module.exports = mongoose.models.Url || mongoose.model("Url", urlSchema);
