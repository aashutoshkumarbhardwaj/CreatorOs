const mongoose = require("mongoose");

const crmMediaKitSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    bio: {
      type: String,
      default: "Tech & Lifestyle Creator building high-impact brand partnerships.",
    },
    stats: {
      followers: { type: Number, default: 125000 },
      engagementRate: { type: String, default: "4.8%" },
      avgViews: { type: Number, default: 45000 },
    },
    packages: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        description: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CrmMediaKit || mongoose.model("CrmMediaKit", crmMediaKitSchema);
