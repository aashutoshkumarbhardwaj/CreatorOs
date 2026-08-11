const mongoose = require("mongoose");

/**
 * @schema contentFolderSchema
 * @description Schema and mock handler for Content OS folders/projects.
 */
const contentFolderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        color: {
            type: String,
            default: "#4338CA",
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
    },
    { timestamps: true }
);

const MongooseContentFolderModel =
    mongoose.models.ContentFolder || mongoose.model("ContentFolder", contentFolderSchema);

const mockFolders = [];

class MockContentFolderModel {
    constructor(data) {
        this._id = data._id || new mongoose.Types.ObjectId().toString();
        this.userId = data.userId;
        this.name = data.name || "General Folder";
        this.color = data.color || "#4338CA";
        this.description = data.description || "";
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static async create(data) {
        const item = new MockContentFolderModel(data);
        mockFolders.push(item);
        return item;
    }

    static find(query = {}) {
        let results = mockFolders.filter((item) => {
            if (query.userId && item.userId?.toString() !== query.userId?.toString()) return false;
            return true;
        });

        const wrapped = {
            sort: () => wrapped,
            lean: async () => results.map((item) => new MockContentFolderModel(item)),
            then: (resolve) => resolve(results.map((item) => new MockContentFolderModel(item))),
        };
        return wrapped;
    }

    static async findById(id) {
        const found = mockFolders.find((item) => item._id?.toString() === id?.toString());
        return found ? new MockContentFolderModel(found) : null;
    }

    static async findByIdAndDelete(id) {
        const idx = mockFolders.findIndex((item) => item._id?.toString() === id?.toString());
        if (idx === -1) return null;
        return mockFolders.splice(idx, 1)[0];
    }

    static async deleteMany(query = {}) {
        let count = 0;
        for (let i = mockFolders.length - 1; i >= 0; i--) {
            if (!query.userId || mockFolders[i].userId?.toString() === query.userId?.toString()) {
                mockFolders.splice(i, 1);
                count++;
            }
        }
        return { deletedCount: count };
    }
}

function getActiveModel() {
    return process.env.USE_MOCK_DB === "true" ? MockContentFolderModel : MongooseContentFolderModel;
}

function ContentFolderModel(data) {
    const ActiveModel = getActiveModel();
    return new ActiveModel(data);
}

ContentFolderModel.find = (...args) => getActiveModel().find(...args);
ContentFolderModel.findById = (...args) => getActiveModel().findById(...args);
ContentFolderModel.create = (...args) => getActiveModel().create(...args);
ContentFolderModel.findByIdAndDelete = (...args) => getActiveModel().findByIdAndDelete(...args);
ContentFolderModel.deleteMany = (...args) => getActiveModel().deleteMany(...args);

module.exports = ContentFolderModel;
