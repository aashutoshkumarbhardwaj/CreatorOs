const mongoose = require("mongoose");

const subtaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  dueDate: {
    type: Date,
  },
});

const reminderSchema = new mongoose.Schema({
  time: {
    type: Date,
    required: true,
  },
  sent: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    enum: ["due_soon", "overdue", "custom"],
    default: "due_soon",
  },
});

const timeLogSchema = new mongoose.Schema({
  durationMinutes: {
    type: Number,
    required: true,
  },
  note: {
    type: String,
    trim: true,
    default: "",
  },
  loggedAt: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: String,
    default: "Creator",
  },
});

const taskSchema = new mongoose.Schema(
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
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "completed", "cancelled"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    category: {
      type: String,
      enum: ["content", "editing", "sponsorship", "admin", "growth", "personal", "other"],
      default: "content",
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    assignedTo: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        email: {
          type: String,
          trim: true,
        },
        name: {
          type: String,
          trim: true,
        },
      },
    ],
    startDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    estimatedHours: {
      type: Number,
      default: 0,
    },
    spentHours: {
      type: Number,
      default: 0,
    },
    subtasks: [subtaskSchema],
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    reminders: [reminderSchema],
    recurring: {
      isRecurring: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "custom"],
        default: "weekly",
      },
      interval: {
        type: Number,
        default: 1,
      },
      nextRunDate: {
        type: Date,
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
    timeLogs: [timeLogSchema],
  },
  { timestamps: true }
);

taskSchema.index({ creatorId: 1, isArchived: 1, status: 1 });
taskSchema.index({ creatorId: 1, dueDate: 1 });

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
