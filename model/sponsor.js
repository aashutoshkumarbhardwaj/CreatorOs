const mongoose = require('mongoose');

const sponsorSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Creator',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    company: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['Lead', 'Contacted', 'Negotiating', 'Closed', 'Lost'],
        default: 'Lead'
    },
    dealValue: {
        type: Number,
        default: 0
    },
    notes: {
        type: String
    }
}, { timestamps: true });

const Sponsor = mongoose.models.Sponsor || mongoose.model('Sponsor', sponsorSchema);

module.exports = Sponsor;
