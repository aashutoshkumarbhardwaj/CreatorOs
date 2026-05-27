const mongoose = require("mongoose");

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

    totalClicks: {
        type: Number,
        default: 0,
    },

    createdAt: [
        {
            timeStamp: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    visitHistory: [
  {
    timestamp: {
      type: Date,
      default: Date.now
    }
  }
]

});

// FIX FOR VERCEL / HOT RELOAD
const MongooseUrlModel =
    mongoose.models.Url || mongoose.model("Url", urlSchema);

// In-memory array for mock URLs
const mockUrls = [];

class MockUrlModel {
    constructor(data) {
        this.shortId = data.shortId;
        this.redirectUrl = data.redirectUrl;
        this.totalClicks = data.totalClicks || 0;
        this.createdAt = data.createdAt || [];
    }

    async save() {
        const existing = mockUrls.find(
            (u) => u.shortId === this.shortId
        );

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
        const found = mockUrls.find(
            (u) => u.shortId === query.shortId
        );

        return found
            ? new MockUrlModel(found)
            : null;
    }
}

module.exports =
    process.env.USE_MOCK_DB === "true"
        ? MockUrlModel
        : MongooseUrlModel;