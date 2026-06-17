const mongoose = require("mongoose");

/**
 * @schema creatorSchema
 * @description Mongoose schema definition for creator.
 */
const creatorSchema = new mongoose.Schema(
    {

bio: {
    type: String,
    trim: true,
    default: "",
},

theme: {
    type: String,
    enum: ["dark", "light"],
    default: "dark",
},

accentColor: {
    type: String,
    default: "#8b5cf6",
},

links: [
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        url: {
            type: String,
            required: true,
            trim: true,
        },
    },
],

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