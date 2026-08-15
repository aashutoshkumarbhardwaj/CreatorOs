const mongoose = require("mongoose");

const contactHistorySchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    enum: ["email", "call", "meeting", "note"],
    default: "note",
  },
  note: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    default: "Creator",
  },
});

const crmBrandSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "Tech",
      trim: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    socialLinks: {
      linkedin: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["lead", "contacted", "negotiating", "partner", "inactive"],
      default: "lead",
    },
    notes: {
      type: String,
      default: "",
    },
    contactHistory: [contactHistorySchema],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CrmBrand || mongoose.model("CrmBrand", crmBrandSchema);
