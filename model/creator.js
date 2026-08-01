const mongoose = require("mongoose");

/**
 * @schema creatorSchema
 * @description Mongoose schema definition for creator.
 */
const creatorSchema = new mongoose.Schema(
    {

bio: {
    type: String,
    trim: true,
    default: "",
},

theme: {
    type: String,
    enum: ["dark", "light"],
    default: "dark",
},

accentColor: {
    type: String,
    default: "#8b5cf6",
},

links: [
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        url: {
            type: String,
            required: true,
            trim: true,
        },
    },
],

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        username: {
            type: String,
            required: true,
            trim: true,
        },
        platform: {
            type: String,
            enum: ["instagram", "youtube", "twitter", "tiktok"],
            required: true,
        },
        profileUrl: {
            type: String,
        },
        avatar: {
            type: String,
        },
        lastRefreshedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

const MongooseCreatorModel = mongoose.models.Creator || mongoose.model("Creator", creatorSchema);

const mockCreators = [];

class MockCreatorModel {
    constructor(data) {
        this._id = data._id || new mongoose.Types.ObjectId().toString();
        this.userId = data.userId;
        this.username = data.username || "creator";
        this.platform = data.platform || "instagram";
        this.profileUrl = data.profileUrl || "";
        this.avatar = data.avatar || "";
        this.bio = data.bio || "";
        this.theme = data.theme || "dark";
        this.accentColor = data.accentColor || "#8b5cf6";
        this.links = data.links || [];
        this.lastRefreshedAt = data.lastRefreshedAt || new Date();
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static create(data) {
        const creator = new MockCreatorModel(data);
        mockCreators.push(creator);
        seedMockAnalyticsForCreator(creator._id);
        const wrapped = {
            lean: async () => creator,
            then: (resolve, reject) => resolve(creator)
        };
        return wrapped;
    }

    static findOne(query = {}) {
        let found = mockCreators.find((item) => {
            if (query.userId && item.userId?.toString() !== query.userId?.toString()) return false;
            if (query._id && item._id?.toString() !== query._id?.toString()) return false;
            return true;
        });

        if (!found && query.userId && process.env.USE_MOCK_DB === "true") {
            found = new MockCreatorModel({
                _id: "creator_" + query.userId.toString().slice(-6),
                userId: query.userId,
                username: "test_creator",
                platform: "instagram",
                profileUrl: "https://instagram.com/test_creator",
                avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
                lastRefreshedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            mockCreators.push(found);
            seedMockAnalyticsForCreator(found._id);
        }

        const wrapped = {
            sort: () => wrapped,
            select: () => wrapped,
            lean: async () => found ? new MockCreatorModel(found) : null,
            then: (resolve, reject) => resolve(found ? new MockCreatorModel(found) : null)
        };
        return wrapped;
    }

    static async findById(id) {
        const found = mockCreators.find((item) => item._id?.toString() === id?.toString());
        return found ? new MockCreatorModel(found) : null;
    }

    static async findByIdAndUpdate(id, update = {}) {
        let found = mockCreators.find((item) => item._id?.toString() === id?.toString());
        if (!found) return null;
        if (update.$set) Object.assign(found, update.$set);
        else Object.assign(found, update);
        found.updatedAt = new Date();
        return new MockCreatorModel(found);
    }

    static async deleteOne(query = {}) {
        const index = mockCreators.findIndex((item) => {
            if (query.userId && item.userId?.toString() !== query.userId?.toString()) return false;
            if (query._id && item._id?.toString() !== query._id?.toString()) return false;
            return true;
        });
        const operation = {
            session: () => operation,
            exec: async () => {
                if (index !== -1) mockCreators.splice(index, 1);
                return { deletedCount: index !== -1 ? 1 : 0 };
            },
            then: (resolve, reject) => operation.exec().then(resolve, reject)
            .catch(err => console.error(err))