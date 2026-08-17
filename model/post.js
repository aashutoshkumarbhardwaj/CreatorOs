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

const MongoosePostModel = mongoose.models.Post || mongoose.model("Post", postSchema);

const mockPosts = [];

class MockPostModel {
    constructor(data) {
        this._id = data._id || new mongoose.Types.ObjectId().toString();
        this.creatorId = data.creatorId;
        this.platform = data.platform || "instagram";
        this.postId = data.postId || "post_" + Math.random().toString(36).slice(2, 9);
        this.caption = data.caption || "";
        this.mediaUrl = data.mediaUrl || "";
        this.likes = data.likes !== undefined ? data.likes : 0;
        this.comments = data.comments !== undefined ? data.comments : 0;
        this.views = data.views !== undefined ? data.views : 0;
        this.postedAt = data.postedAt || new Date();
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static async create(data) {
        const item = new MockPostModel(data);
        mockPosts.push(item);
        return item;
    }

    static find(query = {}) {
        let results = mockPosts.filter((item) => {
            if (query.creatorId && item.creatorId?.toString() !== query.creatorId?.toString()) return false;
            return true;
        });

        const wrapped = {
            sort: (sortObj = {}) => {
                if (sortObj.views === -1) {
                    results.sort((a, b) => (b.views || 0) - (a.views || 0));
                } else if (sortObj.postedAt === -1 || sortObj.createdAt === -1) {
                    results.sort((a, b) => new Date(b.postedAt || b.createdAt) - new Date(a.postedAt || a.createdAt));
                }
                return wrapped;
            },
            select: () => wrapped,
            limit: (n) => { results = results.slice(0, n); return wrapped; },
            lean: async () => results.map((item) => new MockPostModel(item)),
            then: (resolve, reject) => resolve(results.map((item) => new MockPostModel(item)))
        };
        return wrapped;
    }

    static findOne(query = {}) {
        let results = mockPosts.filter((item) => {
            if (query.creatorId && item.creatorId?.toString() !== query.creatorId?.toString()) return false;
            if (query._id && item._id?.toString() !== query._id?.toString()) return false;
            return true;
        });
        const found = results[0] || null;

        const wrapped = {
            sort: () => wrapped,
            select: () => wrapped,
            lean: async () => found ? new MockPostModel(found) : null,
            then: (resolve, reject) => resolve(found ? new MockPostModel(found) : null)
        };
        return wrapped;
    }

    static async countDocuments(query = {}) {
        const results = mockPosts.filter((item) => {
            if (query.creatorId && item.creatorId?.toString() !== query.creatorId?.toString()) return false;
            return true;
        });
        return results.length;
    }

    static async deleteMany(query = {}) {
        let count = 0;
        for (let i = mockPosts.length - 1; i >= 0; i--) {
            if (!query.creatorId || mockPosts[i].creatorId?.toString() === query.creatorId?.toString()) {
                mockPosts.splice(i, 1);
                count++;
            }
        }
        return { deletedCount: count };
    }

    static seedForCreator(creatorId) {
        const exists = mockPosts.some((item) => item.creatorId?.toString() === creatorId?.toString());
        if (!exists) {
            const now = Date.now();
            const samples = [
                { caption: "My Top 5 AI Creator Tools for 2026 🤖", likes: 4250, comments: 380, views: 65400, daysAgo: 3 },
                { caption: "How I Automated My Link Workflow in 5 mins ⚡", likes: 3800, comments: 290, views: 54200, daysAgo: 7 },
                { caption: "Behind the Scenes: Studio Setup Tour 🎥", likes: 3100, comments: 410, views: 48900, daysAgo: 12 },
                { caption: "Why consistency beats viral luck every time #shorts", likes: 2950, comments: 195, views: 42100, daysAgo: 18 },
                { caption: "The unspoken truth about brand sponsorships in 2026 💰", likes: 2680, comments: 315, views: 39500, daysAgo: 24 },
                { caption: "Q&A: Answering your most asked questions 🎙️", likes: 2100, comments: 450, views: 35000, daysAgo: 28 },
            ];
            samples.forEach((s, idx) => {
                mockPosts.push(new MockPostModel({
                    _id: "post_" + Math.random().toString(36).slice(2, 9),
                    creatorId: creatorId,
                    platform: "instagram",
                    postId: "ig_" + (1000 + idx),
                    caption: s.caption,
                    likes: s.likes,
                    comments: s.comments,
                    views: s.views,
                    postedAt: new Date(now - s.daysAgo * 86400000),
                    createdAt: new Date(now - s.daysAgo * 86400000)
                }));
            });
        }
    }
}

// Pre-seed posts for creator_test_001
MockPostModel.seedForCreator("creator_test_001");

function getActiveModel() {
    return process.env.USE_MOCK_DB === "true" ? MockPostModel : MongoosePostModel;
}

function PostModel(data) {
    const ActiveModel = getActiveModel();
    return new ActiveModel(data);
}

PostModel.find = (...args) => getActiveModel().find(...args);
PostModel.findOne = (...args) => getActiveModel().findOne(...args);
PostModel.create = (...args) => getActiveModel().create(...args);
PostModel.countDocuments = (...args) => getActiveModel().countDocuments(...args);
PostModel.deleteMany = (...args) => getActiveModel().deleteMany(...args);
PostModel.seedForCreator = (...args) => getActiveModel().seedForCreator && getActiveModel().seedForCreator(...args);

module.exports = PostModel;
