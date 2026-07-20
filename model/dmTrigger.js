const mongoose = require("mongoose");

const dmTriggerSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    keyword: {
        type: String,
        required: true,
        lowercase: true,
    },
    responseUrl: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
}, { timestamps: true });

module.exports = mongoose.models.DmTrigger || mongoose.model("DmTrigger", dmTriggerSchema);
