const mongoose = require("mongoose");

const linkSchema = new mongoose.Schema({
    type: { type: String, default: 'custom' },
    icon: { type: String, default: '🔗' },
    label: { type: String, required: true },
    url: { type: String, required: true },
    category: { type: String, default: 'other' },
    clicks: { type: Number, default: 0 },
    isEnabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    featured: { type: Boolean, default: false }
});

const socialSchema = new mongoose.Schema({
    platform: { type: String, required: true },
    url: { type: String, required: true },
    icon: { type: String }
});

const bioProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    handle: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    bio: { type: String, default: '' },
    tags: [{ type: String }],
    avatarUrl: { type: String, default: null },
    initials: { type: String, default: '' },
    theme: { type: String, enum: ['light', 'dark', 'neon', 'gradient'], default: 'light' },
    },
    layout: { type: String, enum: ["list", "grid", "cards"], default: "list" },
    background: { type: String },
    contactButton: {
      label: { type: String },
      url: { type: String },
    },
    customDomain: { type: String },
    seo: {
      title: { type: String },
      description: { type: String },
    },
    stats: {
      links: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
    },
    links: [linkSchema],
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.BioProfile || mongoose.model("BioProfile", bioProfileSchema);
