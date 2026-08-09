const mongoose = require("mongoose");

/**
 * @schema analyticsSnapshotSchema
 * @description Mongoose schema definition for analyticsSnapshot.
 */
const analyticsSnapshotSchema = new mongoose.Schema(
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
        followers: { type: Number, default: 0 },
        following: { type: Number, default: 0 },
        totalPosts: { type: Number, default: 0 },
        totalLikes: { type: Number, default: 0 },
        totalComments: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 },
        engagementRate: { type: Number, default: 0 },
        engagementAvailable: { type: Boolean, default: false },
        snapshotDate: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

analyticsSnapshotSchema.index({ creatorId: 1, createdAt: -1 });

const MongooseAnalyticsSnapshotModel =
    mongoose.models.AnalyticsSnapshot ||
    mongoose.model("AnalyticsSnapshot", analyticsSnapshotSchema);

const mockSnapshots = [];

class MockAnalyticsSnapshotModel {
    constructor(data) {
        this._id = data._id || new mongoose.Types.ObjectId().toString();
        this.creatorId = data.creatorId;
        this.platform = data.platform || "instagram";
        this.followers = data.followers !== undefined ? data.followers : 0;
        this.following = data.following !== undefined ? data.following : 0;
        this.totalPosts = data.totalPosts !== undefined ? data.totalPosts : 0;
        this.totalLikes = data.totalLikes !== undefined ? data.totalLikes : 0;
        this.totalComments = data.totalComments !== undefined ? data.totalComments : 0;
        this.totalViews = data.totalViews !== undefined ? data.totalViews : 0;
        this.engagementRate = data.engagementRate !== undefined ? data.engagementRate : 0;
        this.engagementAvailable = data.engagementAvailable !== undefined ? data.engagementAvailable : false;
        this.snapshotDate = data.snapshotDate || new Date();
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static async create(data) {
        const snap = new MockAnalyticsSnapshotModel(data);
        mockSnapshots.push(snap);
        return snap;
    }

    static findOne(query = {}, projection = {}, options = {}) {
        let results = mockSnapshots.filter((item) => {
            if (query.creatorId && item.creatorId?.toString() !== query.creatorId?.toString()) return false;
            if (query._id && item._id?.toString() !== query._id?.toString()) return false;
            return true;
        });
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const found = results[0] || null;

        const wrapped = {
            sort: () => wrapped,
            select: () => wrapped,
            lean: async () => found ? new MockAnalyticsSnapshotModel(found) : null,
            then: (resolve, reject) => resolve(found ? new MockAnalyticsSnapshotModel(found) : null)
        };
        return wrapped;
    }

    static find(query = {}) {
        let results = mockSnapshots.filter((item) => {
            if (query.creatorId && item.creatorId?.toString() !== query.creatorId?.toString()) return false;
            return true;
        });
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const wrapped = {
            sort: () => wrapped,
            select: () => wrapped,
            limit: (n) => { results = results.slice(0, n); return wrapped; },
            lean: async () => results.map((item) => new MockAnalyticsSnapshotModel(item)),
            then: (resolve, reject) => resolve(results.map((item) => new MockAnalyticsSnapshotModel(item)))
        };
        return wrapped;
    }

    static async deleteMany(query = {}) {
        let count = 0;
        for (let i = mockSnapshots.length - 1; i >= 0; i--) {
            if (!query.creatorId || mockSnapshots[i].creatorId?.toString() === query.creatorId?.toString()) {
                mockSnapshots.splice(i, 1);
                count++;
            }
        }
        return { deletedCount: count };
    }

    static seedForCreator(creatorId) {
        const exists = mockSnapshots.some((s) => s.creatorId?.toString() === creatorId?.toString());
        if (!exists) {
            mockSnapshots.push(new MockAnalyticsSnapshotModel({
                _id: "snap_" + Math.random().toString(36).slice(2, 9),
                creatorId: creatorId,
                platform: "instagram",
                followers: 142500,
                following: 840,
                totalPosts: 124,
                totalLikes: 124800,
                totalComments: 18200,
                totalViews: 1850400,
                engagementRate: 5.42,
                engagementAvailable: true,
                snapshotDate: new Date(),
                createdAt: new Date()
            }));
        }
    }
}

// Pre-seed snapshot for creator_test_001
MockAnalyticsSnapshotModel.seedForCreator("creator_test_001");

function getActiveModel() {
    return process.env.USE_MOCK_DB === "true" ? MockAnalyticsSnapshotModel : MongooseAnalyticsSnapshotModel;
}

function AnalyticsSnapshotModel(data) {
    const ActiveModel = getActiveModel();
    return new ActiveModel(data);
}

AnalyticsSnapshotModel.findOne = (...args) => getActiveModel().findOne(...args);
AnalyticsSnapshotModel.find = (...args) => getActiveModel().find(...args);
AnalyticsSnapshotModel.create = (...args) => getActiveModel().create(...args);
AnalyticsSnapshotModel.deleteMany = (...args) => getActiveModel().deleteMany(...args);
AnalyticsSnapshotModel.seedForCreator = (...args) => getActiveModel().seedForCreator && getActiveModel().seedForCreator(...args);

module.exports = AnalyticsSnapshotModel;