const mongoose = require("mongoose");

/**
 * @schema meetingBookingSchema
 * @description Mongoose schema for booked meetings.
 */
const meetingBookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventType",
      required: true,
      index: true,
    },
    attendeeName: {
      type: String,
      required: [true, "Attendee name is required"],
      trim: true,
    },
    attendeeEmail: {
      type: String,
      required: [true, "Attendee email is required"],
      lowercase: true,
      trim: true,
    },
    attendeeNotes: {
      type: String,
      trim: true,
      default: "",
    },
    answers: [
      {
        question: { type: String },
        answer: { type: String },
      },
    ],
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    timeZone: {
      type: String,
      default: "UTC",
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "rescheduled"],
      default: "scheduled",
      index: true,
    },
    locationType: {
      type: String,
      enum: ["google_meet", "phone", "custom"],
      default: "google_meet",
    },
    meetingLink: {
      type: String,
      default: "",
    },
    googleEventId: {
      type: String,
      default: null,
    },
    cancelReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

meetingBookingSchema.index({ userId: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model("MeetingBooking", meetingBookingSchema);
