const mongoose = require("mongoose");

/**
 * @schema contentFolderSchema
 * @description Schema for Content OS folders/projects.
 */

const contentFolderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
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
    mongoose.models.ContentFolder ||
    mongoose.model("ContentFolder", contentFolderSchema);

// Mock database
const mockFolders = [];

class MockContentFolderModel {
    constructor(data = {}) {
        this._id =
            data._id || new mongoose.Types.ObjectId().toString();

        // Prevent userId from being changed after creation
        Object.defineProperty(this, "userId", {
            value: data.userId,
            writable: false,
            enumerable: true,
            configurable: false,
        });

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
            return Object.keys(query).every((key) => {
                if (query[key] == null) return true;

                return (
                    item[key]?.toString() ===
                    query[key]?.toString()
                );
            });
        });

        const wrapped = {
            sort(sortOptions = {}) {
                const entries = Object.entries(sortOptions);

                results.sort((a, b) => {
                    for (const [key, order] of entries) {
                        if (a[key] < b[key]) return -1 * order;
                        if (a[key] > b[key]) return 1 * order;
                    }

                    return 0;
                });

                return wrapped;
            },

            lean: async () => results.map((item) => ({ ...item })),

            then: (resolve, reject) =>
                Promise.resolve(
                    results.map((item) =>
                        new MockContentFolderModel(item)
                    )
                ).then(resolve, reject),

            catch: (reject) =>
                Promise.resolve(
                    results.map((item) =>
                        new MockContentFolderModel(item)
                    )
                ).catch(reject),
        };

        return wrapped;
    }

    static async findById(id) {
        const found = mockFolders.find(
            (item) => item._id.toString() === id?.toString()
        );

        return found
            ? new MockContentFolderModel(found)
            : null;
    }

    static async findByIdAndDelete(id) {
        const index = mockFolders.findIndex(
            (item) => item._id.toString() === id?.toString()
        );

        if (index === -1) return null;

        const deleted = mockFolders.splice(index, 1)[0];

        return new MockContentFolderModel(deleted);
    }

    static async deleteMany(query = {}) {
        let count = 0;

        for (let i = mockFolders.length - 1; i >= 0; i--) {
            const matches = Object.keys(query).every((key) => {
                return (
                    mockFolders[i][key]?.toString() ===
                    query[key]?.toString()
                );
            });

            if (matches) {
                mockFolders.splice(i, 1);
                count++;
            }
        }

        return { deletedCount: count };
    }
}

function getActiveModel() {
    return process.env.USE_MOCK_DB === "true"
        ? MockContentFolderModel
        : MongooseContentFolderModel;
}

function ContentFolderModel(data) {
    const ActiveModel = getActiveModel();
    return new ActiveModel(data);
}

// Forward model methods
ContentFolderModel.find = (...args) =>
    getActiveModel().find(...args);

ContentFolderModel.findById = (...args) =>
    getActiveModel().findById(...args);

ContentFolderModel.create = (...args) =>
    getActiveModel().create(...args);

ContentFolderModel.findByIdAndDelete = (...args) =>
    getActiveModel().findByIdAndDelete(...args);

ContentFolderModel.deleteMany = (...args) =>
    getActiveModel().deleteMany(...args);

module.exports = ContentFolderModel;
