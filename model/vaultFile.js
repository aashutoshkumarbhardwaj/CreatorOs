const mongoose = require("mongoose");
/**
 * @schema vaultFileSchema
 * @description Tracks metadata for files persisted by the Vault (file-upload) service.
 * The actual file bytes live on disk under the configured Vault storage root;
 * this collection is the source of truth for ownership, display name, and size.
 */
const vaultFileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    storedFilename: {
      type: String,
      required: true,
      unique: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("VaultFile", vaultFileSchema);