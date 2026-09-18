const mongoose = require("mongoose");

const teamTaskSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    assigneeName: {
      type: String,
      trim: true,
      default: "Unassigned",
    },
    assigneeEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ["video_editor", "scriptwriter", "thumbnail_artist", "content_strategist", "community_manager", "creator"],
      default: "video_editor",
    },
    status: {
      type: String,
      enum: ["blocked", "todo", "in_progress", "in_review", "completed"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    blockedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TeamTask",
      },
    ],
    dependents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TeamTask",
      },
    ],
    estimatedHours: {
      type: Number,
      default: 2,
    },
    loggedHours: {
      type: Number,
      default: 0,
    },
    dueDate: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

teamTaskSchema.index({ creatorId: 1, status: 1 });

const TeamTask = mongoose.model("TeamTask", teamTaskSchema);

module.exports = TeamTask;
