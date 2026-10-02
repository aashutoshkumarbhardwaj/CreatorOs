const mongoose = require("mongoose");

const dmTriggerSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        immutable: true,
        index: true,
    },
    keyword: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    // Source: inbound DM or comment on a post
    triggerSource: {
        type: String,
        enum: ['dm', 'comment'],
        default: 'dm',
    },
    // Instagram media ID to watch (required when triggerSource === 'comment')
    postId: {
        type: String,
        default: null,
        trim: true,
    },
    // 'partial' = keyword anywhere in the text; 'exact' = whole-word match
    matchType: {
        type: String,
        enum: ['partial', 'exact'],
        default: 'partial',
    },
    // The DM body sent to the commenter / DM sender
    responseText: {
        type: String,
        required: true,
        maxlength: 1000,
        trim: true,
    },
    // Legacy field kept for backwards compatibility
    responseUrl: {
        type: String,
        default: null,
    },
    // Whether to also post a public reply comment under the triggering comment
    commentReply: {
        type: String,
        default: null,
        maxlength: 500,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    // Rolling hourly DM counter per trigger for Meta rate-limit enforcement
    hourlyQuota: {
        count: { type: Number, default: 0, min: [0, 'Hourly count cannot be negative'] },
        windowStart: { type: Date, default: null },
    },
}, { timestamps: true });

// Compound index: quickly look up active comment triggers for a given post
dmTriggerSchema.index({ creatorId: 1, postId: 1, triggerSource: 1, isActive: 1 });

module.exports = mongoose.models.DmTrigger || mongoose.model("DmTrigger", dmTriggerSchema);
