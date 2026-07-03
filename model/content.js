const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        body: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['draft', 'scheduled', 'published', 'archived'],
            default: 'draft',
            index: true,
        },
        publishedAt: {
            type: Date,
            index: true,
        },
        scheduledAt: {
            type: Date,
            index: true,
        },
        userTimeZone: {
            type: String,
            default: 'UTC',
            description: 'IANA timezone used for displaying scheduled time to user',
        },
        metadata: {
            tags: [String],
            category: String,
            mediaUrls: [String],
        },
    },
    {
        timestamps: true,
    }
);

contentSchema.index({ userId: 1, status: 1 });
contentSchema.index({ scheduledAt: 1, status: 1 });

module.exports = mongoose.model('Content', contentSchema);
