const mongoose = require("mongoose");

/**
 * @schema userSchema
 * @description Mongoose schema definition for user.
 */
const userSchema = new mongoose.Schema(
    {
        name: {
        type: String,
        required: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: function () {
                return this.authProvider === "local";
            },
        },

        authProvider: {
            type: String,
            enum: ["local", "google"],
            default: "local",
        },

        role: {
            type: String,
            enum: ["creator", "contributor", "admin"],
            default: "creator",
        },

        googleId: {
            type: String,
            sparse: true,
            unique: true,
        },

        avatar: {
            type: String,
        },
        
        alias: {
            type: String,
            maxlength: 50,
        },
        
        bio: {
            type: String,
            maxlength: 500,
        },
        
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        
        preferences: {
            appearanceMode: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
            interfaceDensity: { type: String, enum: ['compact', 'tactile'], default: 'tactile' },
            motionEffects: { type: Boolean, default: true },
            soundCues: { type: Boolean, default: false },
            autoSaveLinks: { type: Boolean, default: true },
        },

        passwordChangedAt: {
            type: Date,
        },

        subscription: {
            planName: { type: String, default: 'Pro Individual' },
            priceMonthly: { type: Number, default: 29 },
            nextInvoiceDate: { type: Date },
            cardBrand: { type: String, default: 'VISA' },
            cardLast4: { type: String, default: '4242' },
        },

        lastLoginAt: {
            type: Date,
        },
        
        collaborators: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],

        isVerified: {
            type: Boolean,
            default: false,
        },

        verificationToken: {
            type: String,
            sparse: true,
            unique: true,
            index: true,
        },

        verificationTokenExpiry: {
            type: Date,
            index: true,
        },

        scheduledDeletionAt: {
            type: Date,
            index: true,
        },

        deletionConfirmed: {
            type: Boolean,
            default: false,
        },

        deletionConfirmationToken: {
            type: String,
            sparse: true,
            unique: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

const MongooseUserModel = mongoose.models.User || mongoose.model("User", userSchema);

const mockUsers = [];

function normalizeId(id) {
    return id?.toString?.() || id;
}

function matchesQuery(user, query = {}) {
    return Object.entries(query).every(([key, value]) => {
        if (key === "_id") return normalizeId(user._id) === normalizeId(value);
        return user[key] === value;
    });
}

class MockUserModel {
    constructor(data = {}) {
        Object.assign(this, data);
        this._id = data._id || new mongoose.Types.ObjectId();
        this.email = data.email?.toLowerCase?.().trim?.() || data.email;
        this.authProvider = data.authProvider || "local";
        this.role = data.role || "creator";
        this.preferences = data.preferences || {
            appearanceMode: "light",
            interfaceDensity: "tactile",
            motionEffects: true,
            soundCues: false,
            autoSaveLinks: true,
        };
        this.subscription = data.subscription || {
            planName: "Pro Individual",
            priceMonthly: 29,
            cardBrand: "VISA",
            cardLast4: "4242",
        };
        this.isVerified = data.isVerified ?? false;
        this.collaborators = data.collaborators || [];
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    async save() {
        this.updatedAt = new Date();
        const index = mockUsers.findIndex((user) => normalizeId(user._id) === normalizeId(this._id));
        if (index >= 0) {
            mockUsers[index] = this;
        } else {
            mockUsers.push(this);
        }
        return this;
    }

    static async create(data) {
        const user = new MockUserModel(data);
        mockUsers.push(user);
        return user;
    }

    static async findOne(query = {}) {
        return mockUsers.find((user) => matchesQuery(user, query)) || null;
    }

    static findById(id) {
        const getUser = () => mockUsers.find((user) => normalizeId(user._id) === normalizeId(id)) || null;
        const query = {
            select() {
                return query;
            },
            lean() {
                const user = getUser();
                return user ? { ...user } : null;
            },
            then(resolve, reject) {
                return Promise.resolve(getUser()).then(resolve, reject);
            },
            catch(reject) {
                return Promise.resolve(getUser()).catch(reject);
            },
        };

        return query;
    }

    static async findByIdAndUpdate(id, update = {}, options = {}) {
        const user = await MockUserModel.findById(id);
        if (!user) return null;

        if (update.$addToSet) {
            Object.entries(update.$addToSet).forEach(([key, value]) => {
                user[key] = user[key] || [];
                if (!user[key].some((item) => normalizeId(item) === normalizeId(value))) {
                    user[key].push(value);
                }
            });
        }

        Object.entries(update).forEach(([key, value]) => {
            if (!key.startsWith("$")) user[key] = value;
        });

        await user.save();
        return options.new ? user : null;
    }

    static async deleteMany(query = {}) {
        const originalLength = mockUsers.length;
        for (let i = mockUsers.length - 1; i >= 0; i--) {
            if (matchesQuery(mockUsers[i], query)) mockUsers.splice(i, 1);
        }
        return { deletedCount: originalLength - mockUsers.length };
    }

    static deleteOne(query = {}) {
        const operation = {
            async exec() {
                const index = mockUsers.findIndex((user) => matchesQuery(user, query));
                if (index === -1) return { deletedCount: 0 };
                mockUsers.splice(index, 1);
                return { deletedCount: 1 };
            },
            session() {
                return operation;
            },
            then(resolve, reject) {
                return operation.exec().then(resolve, reject);
            },
            catch(reject) {
                return operation.exec().catch(reject);
            },
        };

        return operation;
    }
}

// Pre-seed the test user in Mock DB so login works immediately
(async () => {
    const hashed = await bcrypt.hash("Password123!", 10);
    mockUsers.push(new MockUserModel({
        _id: "000000000000000000000001",
        name: "Test User",
        email: "test@local.com",
        password: hashed,
        role: "creator",
        authProvider: "local",
        alias: "@test_creator",
        bio: "Test user bio goes here.",
        twoFactorEnabled: false,
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
        preferences: {
            appearanceMode: 'light',
            interfaceDensity: 'tactile',
            motionEffects: true,
            soundCues: false,
            autoSaveLinks: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
    }));
})();

function getActiveUserModel() {
    return process.env.USE_MOCK_DB === "true" ? MockUserModel : MongooseUserModel;
}

module.exports = new Proxy(MongooseUserModel, {
    get(target, property, receiver) {
        const activeModel = getActiveUserModel();
        const value = Reflect.get(activeModel, property, activeModel === target ? receiver : activeModel);
        return typeof value === "function" ? value.bind(activeModel) : value;
    },
    construct(target, args) {
        if (process.env.USE_MOCK_DB === "true") {
            return new MockUserModel(...args);
        }
        return Reflect.construct(target, args);
    },
});
