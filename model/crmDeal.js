const mongoose = require("mongoose");

const crmTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  dueDate: {
    type: Date,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
});

const crmContractSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["draft", "sent", "signed", "expired"],
    default: "draft",
  },
  fileUrl: {
    type: String,
    default: "",
  },
  signedDate: {
    type: Date,
  },
});

const crmDealSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmBrand",
    },
    dealName: {
      type: String,
      required: true,
      trim: true,
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
    stage: {
      type: String,
      enum: ["lead", "outreach", "negotiation", "contract", "closed_won", "closed_lost"],
      default: "lead",
    },
    amount: {
      type: Number,
      default: 0,
    },
    deliverables: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    emailedBadge: {
      type: Boolean,
      default: false,
    },
    statusTag: {
      type: String,
      default: "",
    },
    tasks: [crmTaskSchema],
    contracts: [crmContractSchema],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CrmDeal || mongoose.model("CrmDeal", crmDealSchema);
