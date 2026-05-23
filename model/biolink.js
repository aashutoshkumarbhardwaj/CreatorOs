const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  url:      { type: String, required: true },
  icon:     { type: String, default: 'ti-link' }, // Tabler icon class
  clicks:   { type: Number, default: 0 },
  active:   { type: Boolean, default: true },
  order:    { type: Number, default: 0 }
}, { _id: true });

const socialSchema = new mongoose.Schema({
  platform: { type: String }, // 'twitter','instagram','youtube','github','tiktok','linkedin'
  url:      { type: String }
}, { _id: false });

const bioLinkSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, default: '' },
  bio:         { type: String, default: '', maxlength: 160 },
  avatar:      { type: String, default: '' },   // URL or base64
  links:       [linkSchema],
  socials:     [socialSchema],
  theme: {
    type: String,
    enum: ['midnight', 'aurora', 'paper', 'forest', 'rose'],
    default: 'midnight'
  },
  accentColor: { type: String, default: '#7C5CFC' },
  layout:      { type: String, enum: ['stack', 'grid'], default: 'stack' },
  published:   { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('BioLink', bioLinkSchema);
