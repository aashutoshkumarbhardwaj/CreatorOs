const mongoose = require("mongoose");

const creatorSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        username: {
            type: String,
            required: true,
            trim: true,
        },
        platform: {
            type: String,
            enum: ["instagram", "youtube", "twitter", "tiktok"],
            required: true,
        },
        profileUrl: {
            type: String,
        },
        avatar: {
            type: String,
        },
        lastRefreshedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

const CreatorModel = mongoose.models.Creator || mongoose.model("Creator", creatorSchema);
module.exports = CreatorModel;