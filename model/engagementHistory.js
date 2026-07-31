const mongoose = require("mongoose");

/**
 * @schema engagementHistorySchema
 * @description Mongoose schema definition for engagementHistory.
 */
const engagementHistorySchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Creator",
            required: true,
        },
        snapshotId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AnalyticsSnapshot",
            required: true,
        },
        date: { type: Date, default: Date.now },
        followersGrowth: { type: Number, default: 0 },
        likesGrowth: { type: Number, default: 0 },
        commentsGrowth: { type: Number, default: 0 },
        engagementRateDelta: { type: Number, default: 0 },
    },
    { timestamps: true }
);

engagementHistorySchema.index({ creatorId: 1, createdAt: -1 });

const MongooseEngagementHistoryModel =
    mongoose.models.EngagementHistory ||
    mongoose.model("EngagementHistory", engagementHistorySchema);

const mockHistory = [];

class MockEngagementHistoryModel {
    constructor(data) {
        this._id = data._id || new mongoose.Types.ObjectId().toString();
        this.creatorId = data.creatorId;
        this.snapshotId = data.snapshotId || new mongoose.Types.ObjectId().toString();
        this.date = data.date || new Date();
        this.followersGrowth = data.followersGrowth !== undefined ? data.followersGrowth : 0;
        this.likesGrowth = data.likesGrowth !== undefined ? data.likesGrowth : 0;
        this.commentsGrowth = data.commentsGrowth !== undefined ? data.commentsGrowth : 0;
        this.engagementRateDelta = data.engagementRateDelta !== undefined ? data.engagementRateDelta : 0;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static async create(data) {
        const item = new MockEngagementHistoryModel(data);
        mockHistory.push(item);
        return item;
    }

    static find(query = {}) {
        let results = mockHistory.filter((item) => {
            if (query.creatorId && item.creatorId?.toString() !== query.creatorId?.toString()) return false;
            if (query.date && query.date.$gte && new Date(item.date) < new Date(query.date.$gte)) return false;
            return true;
        });

        const wrapped = {
            sort: (sortObj = {}) => {
                if (sortObj.date === 1 || sortObj.createdAt === 1) {
                    results.sort((a, b) => new Date(a.date) - new Date(b.date));
                } else if (sortObj.date === -1 || sortObj.createdAt === -1) {
                    results.sort((a, b) => new Date(b.date) - new Date(a.date));
                }
                return wrapped;
            },
            select: () => wrapped,
            limit: (n) => { results = results.slice(0, n); return wrapped; },
            lean: async () => results.map((item) => new MockEngagementHistoryModel(item)),
            then: (resolve, reject) => resolve(results.map((item) => new MockEngagementHistoryModel(item)))
        };
        return wrapped;
    }

    static async deleteMany(query = {}) {
        let count = 0;
        for (let i = mockHistory.length - 1; i >= 0; i--) {
            if (!query.creatorId || mockHistory[i].creatorId?.toString() === query.creatorId?.toString()) {
                mockHistory.splice(i, 1);
                count++;
            }
        }
        return { deletedCount: count };
    }

    static seedForCreator(creatorId) {
        const exists = mockHistory.some((item) => item.creatorId?.toString() === creatorId?.toString());
        if (!exists) {
            const now = Date.now();
            for (let i = 0; i < 30; i++) {
                const dayDate = new Date(now - (29 - i) * 86400000);
                mockHistory.push(new MockEngagementHistoryModel({
                    _id: "hist_" + Math.random().toString(36).slice(2, 9),
                    creatorId: creatorId,
                    date: dayDate,
                    followersGrowth: Math.floor(150 + Math.random() * 250),
                    likesGrowth: Math.floor(500 + Math.random() * 400),
                    commentsGrowth: Math.floor(50 + Math.random() * 40),
                    engagementRateDelta: Number((4.5 + Math.sin(i * 0.3) * 0.6).toFixed(2)),
                    createdAt: dayDate
                }));
            }
        }
    }
}

// Pre-seed history for creator_test_001
MockEngagementHistoryModel.seedForCreator("creator_test_001");

function getActiveModel() {
    return process.env.USE_MOCK_DB === "true" ? MockEngagementHistoryModel : MongooseEngagementHistoryModel;
}

function EngagementHistoryModel(data) {
    const ActiveModel = getActiveModel();
    return new ActiveModel(data);
}

EngagementHistoryModel.find = (...args) => getActiveModel().find(...args);
EngagementHistoryModel.create = (...args) => getActiveModel().create(...args);
EngagementHistoryModel.deleteMany = (...args) => getActiveModel().deleteMany(...args);
EngagementHistoryModel.seedForCreator = (...args) => getActiveModel().seedForCreator && getActiveModel().seedForCreator(...args);

module.exports = EngagementHistoryModel;