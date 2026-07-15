const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema({
    type: { type: String, required: true },
    icon: { type: String },
    label: { type: String, required: true },
    url: { type: String, required: true },
    category: { type: String }
});

const bioProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    handle: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    bio: { type: String },
    tags: [{ type: String }],
    avatarUrl: { type: String },
    initials: { type: String },
    stats: {
        links: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 }
    },
    links: [linkSchema]
}, { timestamps: true });

module.exports = mongoose.models.BioProfile || mongoose.model('BioProfile', bioProfileSchema);
