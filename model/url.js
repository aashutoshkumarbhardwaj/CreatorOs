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

const MongooseUrlModel = mongoose.models.Url || mongoose.model("Url", urlSchema);

// In-Memory Database Fallback Implementation
const mockUrls = [];

class MockUrlModel {
    constructor(data) {
        this.shortId = data.shortId;
        this.redirectUrl = data.redirectUrl;
        this.campaignName = data.campaignName || "Untitled Campaign";
        this.totalClicks = data.totalClicks || 0;
        this.qrFgColor = data.qrFgColor || "#1a1a1a";
        this.qrBgColor = data.qrBgColor || "#ffffff";
        this.qrGenerated = data.qrGenerated || false;
        this.createdAt = data.createdAt || new Date();
        this.visitHistory = data.visitHistory || [];
    }

    async save() {
        const existing = mockUrls.find((u) => u.shortId === this.shortId);
        if (existing) {
            Object.assign(existing, this);
        } else {
            mockUrls.push(this);
        }
        return this;
    }

    static async create(data) {
        const url = new MockUrlModel(data);
        await url.save();
        return url;
    }

    static async findOne(query) {
        const found = mockUrls.find((u) => u.shortId === query.shortId);
        return found ? new MockUrlModel(found) : null;
    }

    static async findOneAndUpdate(query, update, opts = {}) {
        const found = mockUrls.find((u) => u.shortId === query.shortId);
        if (!found) {
            return opts.upsert 
                ? MockUrlModel.create({ ...query, ...update.$set }) 
                : null;
        }

        if (update.$set) Object.assign(found, update.$set);
        if (update.$push) {
            const [key, val] = Object.entries(update.$push)[0];
            if (!found[key]) found[key] = [];
            found[key].push(val);
        }
        if (update.$inc) {
            const [key, val] = Object.entries(update.$inc)[0];
            found[key] = (found[key] || 0) + val;
        }
        return new MockUrlModel(found);
    }

    static async find(query = {}) {
        let results = mockUrls.filter((u) =>
            Object.entries(query).every(([k, v]) => u[k] === v)
        );
        return {
            sort: () => results.map((u) => new MockUrlModel(u))
        };
    }

    static async findByIdAndDelete(id) {
        const idx = mockUrls.findIndex((u) => u._id === id || u.shortId === id);
        if (idx === -1) return null;
        return mockUrls.splice(idx, 1)[0];
    }
}

function getActiveUrlModel() {
    return process.env.USE_MOCK_DB === "true"
        ? MockUrlModel
        : MongooseUrlModel;
}

function UrlModel(data) {
    const ActiveUrlModel = getActiveUrlModel();
    return new ActiveUrlModel(data);
}

UrlModel.findOne = (...args) => getActiveUrlModel().findOne(...args);
UrlModel.create = (...args) => getActiveUrlModel().create(...args);
UrlModel.findById = (...args) => getActiveUrlModel().findById(...args);
UrlModel.findOneAndUpdate = (...args) => getActiveUrlModel().findOneAndUpdate(...args);
UrlModel.find = (...args) => getActiveUrlModel().find(...args);
UrlModel.findByIdAndDelete = (...args) => getActiveUrlModel().findByIdAndDelete(...args);

module.exports = UrlModel;