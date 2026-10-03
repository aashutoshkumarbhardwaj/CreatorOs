const mongoose = require("mongoose");

const dmDeliverySchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Creator",
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["reserved", "sent"],
      default: "reserved",
      required: true,
    },
    messageId: {
      type: String,
      default: null,
    },
    // A "reserved" row is a lease, not a permanent lock: once leaseExpiresAt has
    // passed (worker crashed / stalled) another attempt may take the delivery over.
    // Rows written before this field existed have no lease and count as expired.
    leaseExpiresAt: {
      type: Date,
      default: null,
    },
    // Identifies the attempt that currently owns the reservation, so a worker
    // whose lease was taken over cannot release the new owner's reservation.
    claimId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

dmDeliverySchema.index(
  { creatorId: 1, eventId: 1 },
  { unique: true },
);

module.exports =
  mongoose.models.DmDelivery ||
  mongoose.model("DmDelivery", dmDeliverySchema);
