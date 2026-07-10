const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
