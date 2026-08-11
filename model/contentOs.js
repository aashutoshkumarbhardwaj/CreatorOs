const mongoose = require("mongoose");

/**
 * @schema contentOsSchema
 * @description Mongoose schema & mock handler for Content OS items (ideas, scripts, posts, templates, drafts).
 */
const contentOsSchema = new mongoose.Schema(
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
        description: {
            type: String,
            default: "",
            trim: true,
        },
        type: {
            type: String,
            enum: ["idea", "script", "post", "template", "draft"],
            default: "idea",
            index: true,
        },
        status: {
            type: String,
            enum: ["idea", "scripting", "filming", "editing", "ready", "scheduled", "published"],
            default: "idea",
            index: true,
        },
        platform: {
            type: String,
            enum: ["instagram", "youtube", "twitter", "tiktok", "linkedin", "blog", "general"],
            default: "general",
            index: true,
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
        },
        folderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ContentFolder",
            default: null,
            index: true,
        },
        tags: [
            {
                type: String,
                trim: true,
            },
        ],
        scriptDetails: {
            hook: { type: String, default: "" },
            body: { type: String, default: "" },
            cta: { type: String, default: "" },
            teleprompterNotes: { type: String, default: "" },
            wordCount: { type: Number, default: 0 },
            estimatedReadTime: { type: Number, default: 0 }, // in seconds
        },
        mediaAssets: [
            {
                url: { type: String, required: true },
                type: { type: String, default: "image" },
                name: { type: String, default: "asset" },
            },
        ],
        scheduledAt: {
            type: Date,
            default: null,
        },
        publishedAt: {
            type: Date,
            default: null,
        },
        aiGenerated: {
            type: Boolean,
            default: false,
        },
        integrations: {
            notionId: { type: String, default: "" },
            gdocsUrl: { type: String, default: "" },
            canvaUrl: { type: String, default: "" },
            chatGptPrompt: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

contentOsSchema.index({ userId: 1, status: 1 });
contentOsSchema.index({ userId: 1, platform: 1 });

const MongooseContentOsModel =
    mongoose.models.ContentOs || mongoose.model("ContentOs", contentOsSchema);

// In-Memory Mock Implementation for process.env.USE_MOCK_DB === "true"
const mockItems = [];

class MockContentOsModel {
    constructor(data) {
        this._id = data._id || new mongoose.Types.ObjectId().toString();
        this.userId = data.userId;
        this.title = data.title || "Untitled Content";
        this.description = data.description || "";
        this.type = data.type || "idea";
        this.status = data.status || "idea";
        this.platform = data.platform || "general";
        this.priority = data.priority || "medium";
        this.folderId = data.folderId || null;
        this.tags = data.tags || [];
        this.scriptDetails = {
            hook: data.scriptDetails?.hook || "",
            body: data.scriptDetails?.body || "",
            cta: data.scriptDetails?.cta || "",
            teleprompterNotes: data.scriptDetails?.teleprompterNotes || "",
            wordCount: data.scriptDetails?.wordCount || 0,
            estimatedReadTime: data.scriptDetails?.estimatedReadTime || 0,
        };
        this.mediaAssets = data.mediaAssets || [];
        this.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
        this.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
        this.aiGenerated = Boolean(data.aiGenerated);
        this.integrations = {
            notionId: data.integrations?.notionId || "",
            gdocsUrl: data.integrations?.gdocsUrl || "",
            canvaUrl: data.integrations?.canvaUrl || "",
            chatGptPrompt: data.integrations?.chatGptPrompt || "",
        };
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static async create(data) {
        const item = new MockContentOsModel(data);
        mockItems.push(item);
        return item;
    }

    static find(query = {}) {
        let results = mockItems.filter((item) => {
            if (query.userId && item.userId?.toString() !== query.userId?.toString()) return false;
            if (query.status && item.status !== query.status) return false;
            if (query.type && item.type !== query.type) return false;
            if (query.platform && item.platform !== query.platform) return false;
            if (query.folderId && item.folderId?.toString() !== query.folderId?.toString()) return false;
            return true;
        });

        const wrapped = {
            sort: (sortObj = {}) => {
                if (sortObj.createdAt === -1 || sortObj.updatedAt === -1) {
                    results.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
                }
                return wrapped;
            },
            limit: (n) => {
                results = results.slice(0, n);
                return wrapped;
            },
            lean: async () => results.map((item) => new MockContentOsModel(item)),
            then: (resolve) => resolve(results.map((item) => new MockContentOsModel(item))),
        };
        return wrapped;
    }

    static findOne(query = {}) {
        const results = mockItems.filter((item) => {
            if (query.userId && item.userId?.toString() !== query.userId?.toString()) return false;
            if (query._id && item._id?.toString() !== query._id?.toString()) return false;
            return true;
        });
        const found = results[0] || null;
        const wrapped = {
            lean: async () => (found ? new MockContentOsModel(found) : null),
            then: (resolve) => resolve(found ? new MockContentOsModel(found) : null),
        };
        return wrapped;
    }

    static async findById(id) {
        const found = mockItems.find((item) => item._id?.toString() === id?.toString());
        return found ? new MockContentOsModel(found) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const idx = mockItems.findIndex((item) => item._id?.toString() === id?.toString());
        if (idx === -1) return null;
        const current = mockItems[idx];
        const updatedData = { ...current, ...(update.$set || update), updatedAt: new Date() };
        mockItems[idx] = new MockContentOsModel(updatedData);
        return mockItems[idx];
    }

    static async findByIdAndDelete(id) {
        const idx = mockItems.findIndex((item) => item._id?.toString() === id?.toString());
        if (idx === -1) return null;
        const removed = mockItems.splice(idx, 1)[0];
        return removed;
    }

    static async countDocuments(query = {}) {
        const results = mockItems.filter((item) => {
            if (query.userId && item.userId?.toString() !== query.userId?.toString()) return false;
            if (query.status && item.status !== query.status) return false;
            return true;
        });
        return results.length;
    }

    static async deleteMany(query = {}) {
        let count = 0;
        for (let i = mockItems.length - 1; i >= 0; i--) {
            if (!query.userId || mockItems[i].userId?.toString() === query.userId?.toString()) {
                mockItems.splice(i, 1);
                count++;
            }
        }
        return { deletedCount: count };
    }

    static seedForUser(userId) {
        const exists = mockItems.some((item) => item.userId?.toString() === userId?.toString());
        if (!exists) {
            const sampleItems = [
                {
                    title: "10 AI Tools Every Creator Needs in 2026",
                    description: "High energy breakdown of essential AI automation tools.",
                    type: "idea",
                    status: "idea",
                    platform: "youtube",
                    priority: "high",
                    tags: ["AI", "Tools", "Productivity"],
                },
                {
                    title: "How I Built My Entire Link-in-Bio in 5 Mins",
                    description: "Behind the scenes screen share reel.",
                    type: "script",
                    status: "scripting",
                    platform: "instagram",
                    priority: "medium",
                    tags: ["Tutorial", "BioLink", "Reels"],
                    scriptDetails: {
                        hook: "Stop paying $20/mo for link bio tools! Here is how to build one for free in 5 minutes.",
                        body: "1. Open CreatorOS\n2. Select Smart Bio\n3. Customize your colors and custom slug\n4. Publish!",
                        cta: "Comment 'BIO' and I'll send you the direct link!",
                        teleprompterNotes: "Speak energetically, point to screen.",
                        wordCount: 45,
                        estimatedReadTime: 18,
                    },
                },
                {
                    title: "The Ultimate Content Calendar Workflow",
                    description: "Step by step breakdown of planning 30 days of content.",
                    type: "post",
                    status: "ready",
                    platform: "twitter",
                    priority: "urgent",
                    tags: ["Workflow", "Threads"],
                    scheduledAt: new Date(Date.now() + 86400000 * 2),
                },
            ];
            sampleItems.forEach((s) => {
                mockItems.push(
                    new MockContentOsModel({
                        ...s,
                        userId: userId,
                    })
                );
            });
        }
    }
}

function getActiveModel() {
    return process.env.USE_MOCK_DB === "true" ? MockContentOsModel : MongooseContentOsModel;
}

function ContentOsModel(data) {
    const ActiveModel = getActiveModel();
    return new ActiveModel(data);
}

ContentOsModel.find = (...args) => getActiveModel().find(...args);
ContentOsModel.findOne = (...args) => getActiveModel().findOne(...args);
ContentOsModel.findById = (...args) => getActiveModel().findById(...args);
ContentOsModel.create = (...args) => getActiveModel().create(...args);
ContentOsModel.findByIdAndUpdate = (...args) => getActiveModel().findByIdAndUpdate(...args);
ContentOsModel.findByIdAndDelete = (...args) => getActiveModel().findByIdAndDelete(...args);
ContentOsModel.countDocuments = (...args) => getActiveModel().countDocuments(...args);
ContentOsModel.deleteMany = (...args) => getActiveModel().deleteMany(...args);
ContentOsModel.seedForUser = (...args) =>
    getActiveModel().seedForUser && getActiveModel().seedForUser(...args);

module.exports = ContentOsModel;
