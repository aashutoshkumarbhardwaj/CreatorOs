const mongoose = require("mongoose");

/**
 * @schema postSchema
 * @description Mongoose schema definition for post.
 */
const postSchema = new mongoose.Schema(
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
        postId: { type: String, required: true },
        caption: { type: String },
        mediaUrl: { type: String },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        postedAt: { type: Date },
    },
    { timestamps: true }
);

const PostModel = mongoose.models.Post || mongoose.model("Post", postSchema);
module.exports = PostModel;
