const mongoose = require("mongoose");

/**
 * @schema contributorSessionSchema
 * @description Mongoose schema definition for contributorSession.
 */
const contributorSessionSchema = new mongoose.Schema(
    {
        contributorId: {
            type: String,
            required: true,
            unique: true,
        },
        role: {
            type: String,
            default: "guest_contributor",
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 },
        },
    },
    {
        timestamps: true,
    }
);

const MongooseContributorSessionModel =
    mongoose.models.ContributorSession ||
    mongoose.model("ContributorSession", contributorSessionSchema);

const mockSessions = [];

class MockContributorSessionModel {
    constructor(data) {
        this._id = data._id || new mongoose.Types.ObjectId().toString();
        this.contributorId = data.contributorId;
        this.role = data.role || "guest_contributor";
        this.createdAt = data.createdAt || new Date();
        this.expiresAt = data.expiresAt;
    }

    static async create(data) {
        const session = new MockContributorSessionModel(data);
        mockSessions.push(session);
        return session;
    }

    static async findOne(query = {}) {
        const now = new Date();
        const session = mockSessions.find((item) => {
            return item.contributorId === query.contributorId && item.expiresAt > now;
        });

        return session || null;
    }
}

function getActiveContributorSessionModel() {
    return process.env.USE_MOCK_DB === "true"
        ? MockContributorSessionModel
        : MongooseContributorSessionModel;
}

module.exports = {
    create: (...args) => getActiveContributorSessionModel().create(...args),
    findOne: (...args) => getActiveContributorSessionModel().findOne(...args),
};
