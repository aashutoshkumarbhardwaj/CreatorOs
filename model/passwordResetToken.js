const mongoose = require('mongoose');

/**
 * PasswordResetToken Schema
 * Stores password reset tokens with expiration and single-use enforcement.
 * Tokens are automatically deleted after 15 minutes via MongoDB TTL index.
 */
const passwordResetTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true,
    },
    used: {
        type: Boolean,
        default: false,
        index: true,
    },
    usedAt: {
        type: Date,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 900, // Auto-delete after 15 minutes (900 seconds)
    },
});

module.exports = mongoose.models.PasswordResetToken ||
    mongoose.model('PasswordResetToken', passwordResetTokenSchema);
