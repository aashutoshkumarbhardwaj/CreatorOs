const mongoose = require("mongoose");

/**
 * @schema qrCodeSchema
 * @description Mongoose schema for trackable, customizable QR codes.
 */
const qrCodeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        label: {
            type: String,
            trim: true,
            default: "",
        },
        inputType: {
            type: String,
            enum: ["url", "text"],
            default: "url",
            index: true,
        },
        campaignName: {
            type: String,
            trim: true,
            default: "",
            index: true,
        },
        targetUrl: {
            type: String,
            required: true,
        },
        isDynamic: {
            type: Boolean,
            default: true,
        },
        shortId: {
            type: String,
            unique: true,
            sparse: true,
        },
        design: {
            foregroundColor: {
                type: String,
                default: "#000000",
            },
            backgroundColor: {
                type: String,
                default: "#FFFFFF",
            },
            patternPreset: {
                type: String,
                enum: ["A", "B", "C", "D", "E"],
                default: "A",
            },
            logoUrl: {
                type: String,
                default: null,
            },
            errorCorrectionLevel: {
                type: String,
                enum: ["L", "M", "Q", "H"],
                default: "M",
            },
        },
        batchId: {
            type: mongoose.Schema.Types.ObjectId,
            index: true,
            default: null,
        },
        totalScans: {
            type: Number,
            default: 0,
        },
        scanHistory: [
            {
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                ip: { type: String, default: null },
                country: { type: String, default: null },
                city: { type: String, default: null },
                device: { type: String, default: null },
            },
        ],
        formats: {
            svg: { type: Boolean, default: false },
            png: { type: Boolean, default: false },
            pdf: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
);

qrCodeSchema.statics.listForUser = async function (userId, limit = 100) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

module.exports = mongoose.models.QrCode || mongoose.model("QrCode", qrCodeSchema);
