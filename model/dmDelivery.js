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
