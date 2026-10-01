const mongoose = require("mongoose");

const idempotencyRecordSchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    requestPath: {
      type: String,
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["in_flight", "resolved", "failed"],
      default: "in_flight",
      index: true,
    },
    responseStatusCode: {
      type: Number,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index
    },
  },
  {
    timestamps: true,
  }
);

const IdempotencyRecord = mongoose.model("IdempotencyRecord", idempotencyRecordSchema);

module.exports = IdempotencyRecord;
