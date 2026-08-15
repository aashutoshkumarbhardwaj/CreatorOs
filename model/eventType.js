const mongoose = require("mongoose");

/**
 * @schema eventTypeSchema
 * @description Mongoose schema for meeting/event templates (Cal.com style).
 */
const eventTypeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    duration: {
      type: Number,
      required: true,
      default: 30, // in minutes
      min: 5,
      max: 480,
    },
    locationType: {
      type: String,
      enum: ["google_meet", "phone", "custom"],
      default: "google_meet",
    },
    locationDetails: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    color: {
      type: String,
      default: "#6366f1",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    availability: {
      days: {
        type: [String],
        default: ["mon", "tue", "wed", "thu", "fri"],
      },
      startTime: {
        type: String,
        default: "09:00",
      },
      endTime: {
        type: String,
        default: "17:00",
      },
      timeZone: {
        type: String,
        default: "UTC",
      },
    },
    bufferBefore: {
      type: Number,
      default: 0,
      min: 0,
    },
    bufferAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    customQuestions: [
      {
        label: { type: String, required: true },
        required: { type: Boolean, default: false },
        fieldType: {
          type: String,
          enum: ["text", "textarea", "select"],
          default: "text",
        },
        options: [String],
      },
    ],
  },
  {
    timestamps: true,
  }
);

eventTypeSchema.index({ userId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model("EventType", eventTypeSchema);
