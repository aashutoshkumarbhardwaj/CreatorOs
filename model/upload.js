const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    filename: { type: String, required: true },
    hfPath: { type: String, required: true },
    url: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    folder: { type: String, default: "" },
  },
  { timestamps: true },
);

uploadSchema.index({ filename: "text" });

module.exports = mongoose.model("Upload", uploadSchema);