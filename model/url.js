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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
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
      x: { type: Number },
      y: { type: Number },
      device: { type: String, default: "Desktop" },
      browser: { type: String, default: "Unknown" },
      referrer: { type: String, default: "Direct" },
      country: { type: String, default: "Unknown" },
    },
  ],
});

urlSchema.statics.listForUser = async function (userId, options = {}) {
  const limit = typeof options === "number" ? options : options.limit || 100;
  const cursor = typeof options === "object" ? options.cursor : null;
  const query = { userId };

  if (cursor) {
    const cursorLink = await this.findOne({ _id: cursor, userId })
      .select("createdAt")
      .lean();

    if (!cursorLink) return [];

    query.$or = [
      { createdAt: { $lt: cursorLink.createdAt } },
      { createdAt: cursorLink.createdAt, _id: { $lt: cursor } },
    ];
  }

  return this.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
};

urlSchema.statics.getStatsForUser = async function (userId) {
  const totalLinks = await this.countDocuments({ userId });
  const allLinks = await this.find({ userId })
    .select("totalClicks title redirectUrl")
    .lean();
  const totalClicks = allLinks.reduce(
    (sum, u) => sum + (u.totalClicks || 0),
    0,
  );
  const topLink = allLinks.reduce(
    (best, u) => ((u.totalClicks || 0) > (best?.totalClicks || 0) ? u : best),
    null,
  );
  return {
    totalLinks,
    totalClicks,
    topLink,
  };
};

const MongooseUrlModel =
  mongoose.models.Url || mongoose.model("Url", urlSchema);
const mockUrls = [];

class MockUrlModel {
  constructor(data) {
    Object.assign(this, data);
    this._id = data._id || new mongoose.Types.ObjectId();
    this.shortId = data.shortId;
    this.redirectUrl = data.redirectUrl;
    this.campaignName = data.campaignName || "Untitled Campaign";
    this.userId = data.userId;
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
    const found = mockUrls.find(
      (u) =>
        u.shortId === query.shortId ||
        u._id?.toString() === query._id?.toString(),
    );
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
      for (const [key, val] of Object.entries(update.$push)) {
        if (!found[key]) found[key] = [];
        if (val && val.$each && Array.isArray(val.$each)) {
          found[key].push(...val.$each);
        } else {
          found[key].push(val);
        }
      }
    }
    if (update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        found[key] = (found[key] || 0) + val;
      }
    }
    return new MockUrlModel(found);
  }

  static find(query = {}) {
    const keys = Object.keys(query);
    let results = mockUrls.filter((u) =>
      keys.every((k) => u[k]?.toString() === query[k]?.toString()),
    );
    const wrapped = {
      sort: () => wrapped,
      select: () => wrapped,
      limit: (n) => {
        results = results.slice(0, n);
        return wrapped;
      },
      lean: async () => results.map((u) => new MockUrlModel(u)),
      then: (resolve, reject) =>
        resolve(results.map((u) => new MockUrlModel(u))),
    };
    return wrapped;
  }

  static async findByIdAndDelete(id) {
    const idx = mockUrls.findIndex((u) => u._id === id || u.shortId === id);
    if (idx === -1) return null;
    return mockUrls.splice(idx, 1)[0];
  }

  static async findOneAndDelete(query = {}) {
    const idx = mockUrls.findIndex((u) => {
      if (query.shortId && u.shortId !== query.shortId) return false;
      if (query._id && u._id !== query._id) return false;
      return true;
    });
    if (idx === -1) return null;
    return mockUrls.splice(idx, 1)[0];
  }

  static async deleteOne(query = {}) {
    const deleted = await MockUrlModel.findOneAndDelete(query);
    return { deletedCount: deleted ? 1 : 0 };
  }

  static async deleteMany(query = {}) {
    const keys = Object.keys(query);
    let count = 0;
    for (let i = mockUrls.length - 1; i >= 0; i--) {
      const item = mockUrls[i];
      if (keys.every((k) => item[k]?.toString() === query[k]?.toString())) {
        mockUrls.splice(i, 1);
        count++;
      }
    }
    return { deletedCount: count };
  }

  static async listForUser(userId, options = {}) {
    const limit = typeof options === "number" ? options : options.limit || 100;
    const cursor = typeof options === "object" ? options.cursor : null;
    let results = mockUrls.filter(
      (u) => (u.userId?.toString() || null) === (userId?.toString() || null),
    );
    if (cursor) {
      const cursorIndex = results.findIndex(
        (u) => u._id?.toString() === cursor?.toString() || u.shortId === cursor,
      );
      if (cursorIndex === -1) return [];
      const cursorItem = results[cursorIndex];
      results = results.filter((u) => {
        const createdDiff =
          new Date(u.createdAt) - new Date(cursorItem.createdAt);
        if (createdDiff < 0) return true;
        if (createdDiff > 0) return false;
        return (
          (u._id?.toString() || u.shortId) <
          (cursorItem._id?.toString() || cursorItem.shortId)
        );
      });
    }
    return results
      .sort(
        (a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt) ||
          String(b._id || b.shortId).localeCompare(String(a._id || a.shortId)),
      )
      .slice(0, limit)
      .map((u) => new MockUrlModel(u));
  }

  static async countDocuments(query = {}) {
    if (query.userId !== undefined) {
      return mockUrls.filter((u) => u.userId === query.userId).length;
    }
    const keys = Object.keys(query);
    return mockUrls.filter((u) =>
      keys.every((k) => u[k]?.toString() === query[k]?.toString()),
    ).length;
  }

  static async aggregate(pipeline) {
    const matchStage = pipeline.find((s) => s.$match);
    const groupStage = pipeline.find((s) => s.$group);
    let items = [...mockUrls];
    if (matchStage) {
      const keys = Object.keys(matchStage.$match);
      items = items.filter((u) =>
        keys.every(
          (k) =>
            (u[k]?.toString() || null) ===
            (matchStage.$match[k]?.toString() || null),
        ),
      );
    }
    if (groupStage) {
      const totalClicks = items.reduce(
        (sum, u) => sum + (u.totalClicks || 0),
        0,
      );
      const topClicks = items.reduce(
        (max, u) => Math.max(max, u.totalClicks || 0),
        0,
      );
      return [{ _id: groupStage.$group._id, totalClicks, topClicks }];
    }
    return items;
  }

  static async getStatsForUser(userId) {
    const userLinks = mockUrls.filter(
      (u) =>
        u.userId?.toString() === userId?.toString() || (!u.userId && !userId),
    );
    const totalLinks = userLinks.length;
    const totalClicks = userLinks.reduce(
      (sum, u) => sum + (u.totalClicks || 0),
      0,
    );
    const topLink = userLinks.reduce(
      (best, u) => ((u.totalClicks || 0) > (best?.totalClicks || 0) ? u : best),
      null,
    );
    return {
      totalLinks,
      totalClicks,
      topLink,
    };
  }
}

function getActiveUrlModel() {
  return process.env.USE_MOCK_DB === "true" ? MockUrlModel : MongooseUrlModel;
}

function UrlModel(data) {
  const ActiveUrlModel = getActiveUrlModel();
  return new ActiveUrlModel(data);
}

UrlModel.findOne = (...args) => getActiveUrlModel().findOne(...args);
UrlModel.create = (...args) => getActiveUrlModel().create(...args);
UrlModel.findById = (...args) => getActiveUrlModel().findById(...args);
UrlModel.findOneAndUpdate = (...args) =>
  getActiveUrlModel().findOneAndUpdate(...args);
UrlModel.find = (...args) => getActiveUrlModel().find(...args);
UrlModel.findByIdAndDelete = (...args) =>
  getActiveUrlModel().findByIdAndDelete(...args);
UrlModel.findOneAndDelete = (...args) =>
  getActiveUrlModel().findOneAndDelete &&
  getActiveUrlModel().findOneAndDelete(...args);
UrlModel.deleteOne = (...args) =>
  getActiveUrlModel().deleteOne && getActiveUrlModel().deleteOne(...args);
UrlModel.deleteMany = (...args) => getActiveUrlModel().deleteMany(...args);
UrlModel.listForUser = (...args) => getActiveUrlModel().listForUser(...args);
UrlModel.countDocuments = (...args) =>
  getActiveUrlModel().countDocuments(...args);
UrlModel.aggregate = (...args) => getActiveUrlModel().aggregate(...args);
UrlModel.getStatsForUser = (...args) =>
  getActiveUrlModel().getStatsForUser(...args);

module.exports = UrlModel;
