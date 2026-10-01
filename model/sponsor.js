const mongoose = require("mongoose");

const sponsorSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    companyName: {
        type: String,
        required: true,
    },
    contactName: {
        type: String,
    },
    contactEmail: {
        type: String,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'contactEmail must be a valid email address'],
    },
    status: {
        type: String,
        enum: ['lead', 'contacted', 'negotiating', 'closed', 'lost'],
        default: 'lead',
    },
    value: {
        type: Number,
        default: 0,
    },
    notes: {
        type: String,
    },
}, { timestamps: true });

module.exports = mongoose.models.Sponsor || mongoose.model("Sponsor", sponsorSchema);
