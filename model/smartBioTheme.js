const mongoose = require("mongoose");

const bioWidgetSchema = new mongoose.Schema({
  widgetType: {
    type: String,
    enum: ["link_card", "video_embed", "newsletter_optin", "product_highlight", "social_grid"],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  destinationUrl: {
    type: String,
    trim: true,
  },
  embedUrl: {
    type: String,
    trim: true,
  },
  iconName: {
    type: String,
    default: "link",
  },
  animation: {
    type: String,
    enum: ["none", "pulse", "bounce", "glow"],
    default: "none",
  },
  clicks: {
    type: Number,
    default: 0,
  },
  orderIndex: {
    type: Number,
    default: 0,
  },
});

const bioLeadSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  firstName: {
    type: String,
    default: "",
  },
  collectedAt: {
    type: Date,
    default: Date.now,
  },
});

const smartBioThemeSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    themePreset: {
      type: String,
      enum: ["midnight_neon", "minimal_clean", "sunset_glow", "glassmorphic_aurora", "custom"],
      default: "midnight_neon",
    },
    customStyles: {
      bgColor1: { type: String, default: "#0F172A" },
      bgColor2: { type: String, default: "#1E293B" },
      cardBg: { type: String, default: "rgba(255, 255, 255, 0.08)" },
      textColor: { type: String, default: "#F8FAFC" },
      accentColor: { type: String, default: "#38BDF8" },
      borderRadiusPx: { type: Number, default: 12 },
      fontFamily: { type: String, default: "Inter" },
    },
    bioText: {
      type: String,
      maxlength: 250,
      default: "",
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    widgets: [bioWidgetSchema],
    leads: [bioLeadSchema],
    totalViews: {
      type: Number,
      default: 0,
    },
    totalClicks: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const SmartBioTheme = mongoose.model("SmartBioTheme", smartBioThemeSchema);

module.exports = SmartBioTheme;
