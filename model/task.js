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

/** Reference from a task to a record in another CreatorOS module. */
const taskLinkSchema = new mongoose.Schema({
  module: {
    type: String,
    enum: [
      "crm_deal",
      "crm_brand",
      "crm_invoice",
      "content_os",
      "scheduled_content",
      "url",
      "meeting",
      "vault_file",
    ],
    required: true,
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  label: {
    type: String,
    trim: true,
    default: "",
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

/** Comment body is plain text only, never HTML, so there is no stored-XSS surface. */
const commentSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    attachments: [
      {
        _id: false,
        name: { type: String, trim: true },
        url: { type: String, trim: true },
      },
    ],
    editedAt: Date,
    // Soft delete keeps the thread and history coherent.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** Append-only change history. */
const activitySchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: { type: String, required: true },
    from: { type: mongoose.Schema.Types.Mixed, default: null },
    to: { type: mongoose.Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Optional: tasks without a workspace are personal and scoped by creatorId,
    // so every existing task keeps working with no migration.
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      index: true,
    },
    // _id of a project embedded in the workspace document.
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
    // Flat mirror of assignedTo[].userId, kept in sync by the hooks below.
    // Indexed for permission checks and workload aggregation.
    assigneeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    watchers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    visibility: {
      type: String,
      enum: ["workspace", "project", "private"],
      default: "workspace",
    },
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
      min: 0,
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
        enum: ["daily", "weekly", "monthly", "yearly", "custom"],
        default: "weekly",
      },
      interval: {
        type: Number,
        default: 1,
      },
      nextRunDate: {
        type: Date,
      },
      // Weekdays (0=Sun) for weekly rules.
      byWeekday: [
        {
          type: Number,
          min: 0,
          max: 6,
        },
      ],
      timezone: {
        type: String,
        default: "UTC",
      },
      endDate: {
        type: Date,
      },
      maxOccurrences: {
        type: Number,
      },
      generatedCount: {
        type: Number,
        default: 0,
      },
      // High-water mark so a re-run never regenerates past occurrences.
      lastGeneratedFor: {
        type: Date,
      },
    },
    // Series identity. seriesId points at the recurring parent; occurrenceKey is
    // the occurrence's local date. Together they carry a unique index that makes
    // duplicate generation impossible at the database level.
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    occurrenceKey: {
      type: String,
      trim: true,
    },
    // Cross-module references to CRM deals, content, campaigns and more.
    links: [taskLinkSchema],
    comments: [commentSchema],
    activity: [activitySchema],
    // Key of the built-in template this task was created from, if any.
    templateKey: {
      type: String,
      trim: true,
    },
    // Rank for drag-and-drop ordering within a board column.
    boardOrder: {
      type: Number,
      default: 0,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
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

// Board, list, calendar and workload query paths.
taskSchema.index({ workspaceId: 1, projectId: 1, status: 1, dueDate: 1 });
taskSchema.index({ workspaceId: 1, assigneeIds: 1, status: 1 });
taskSchema.index({ workspaceId: 1, status: 1, boardOrder: 1 });

// Makes duplicate recurrence generation impossible regardless of worker retries,
// concurrent runs or restarts. Partial so non-recurring tasks are unaffected.
taskSchema.index(
  { seriesId: 1, occurrenceKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      seriesId: { $exists: true },
      occurrenceKey: { $exists: true },
    },
  }
);

function extractAssigneeIds(assignedTo) {
  const ids = (assignedTo || [])
    .map((entry) => entry && entry.userId)
    .filter(Boolean)
    .map(String);

  return [...new Set(ids)];
}

const has = (obj, key) => Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Activity entries describing a change between two task states.
 * dueDate is compared as an ISO string so equal dates are not reported.
 */
function diffActivity(before = {}, after = {}, actorId = null) {
  const entries = [];
  const normalise = (field, v) => {
    if (v === undefined || v === null || v === "") return null;
    return field === "dueDate" ? new Date(v).toISOString() : String(v);
  };

  ["status", "priority", "dueDate"].forEach((field) => {
    if (!has(after, field)) return;
    const from = normalise(field, before[field]);
    const to = normalise(field, after[field]);
    if (from !== to) entries.push({ actorId, type: `${field}_changed`, from, to });
  });

  if (has(after, "assigneeIds")) {
    const was = (before.assigneeIds || []).map(String);
    const now = (after.assigneeIds || []).map(String);
    now.filter((id) => !was.includes(id)).forEach((id) => entries.push({ actorId, type: "assigned", to: id }));
    was.filter((id) => !now.includes(id)).forEach((id) => entries.push({ actorId, type: "unassigned", from: id }));
  }

  return entries;
}

taskSchema.statics.diffActivity = diffActivity;

// Keep assigneeIds in sync on document saves.
taskSchema.pre("save", function syncAssigneeIds(next) {
  if (this.isModified("assignedTo")) {
    this.assigneeIds = extractAssigneeIds(this.assignedTo);
  }
  next();
});

// The existing update endpoint passes the request body straight to
// findByIdAndUpdate. These fields are managed server-side only, so a client
// must not be able to move a task into another workspace, rewrite comments or
// erase history through it.
const SERVER_MANAGED = ["workspaceId", "comments", "activity", "assigneeIds", "seriesId", "occurrenceKey"];

// ($-operators in request bodies are already neutralised by express-mongo-sanitize.)
taskSchema.pre("findOneAndUpdate", function stripServerManagedFields(next) {
  const update = this.getUpdate();
  if (!update || Array.isArray(update)) return next();

  [update, update.$set].forEach((target) => {
    if (target) SERVER_MANAGED.forEach((field) => delete target[field]);
  });

  this.setUpdate(update);
  next();
});

// assignedTo may sit at the top level or inside $set, and timestamps inject a
// $set of their own, so both places have to be checked rather than assuming one.
taskSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function syncAssigneeIdsOnUpdate(next) {
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) return next();

    const target = [update.$set, update].find((candidate) => has(candidate, "assignedTo"));
    if (!target) return next();

    target.assigneeIds = extractAssigneeIds(target.assignedTo);
    this.setUpdate(update);
    next();
  }
);

// Record status, priority, due-date and assignment changes made through the
// existing endpoints. Those routes are creator-only, so the creator is the actor.
taskSchema.pre("findOneAndUpdate", async function recordActivity() {
  const update = this.getUpdate();
  if (!update || Array.isArray(update)) return;

  const changes = {};
  [update, update.$set].forEach((source) => {
    ["status", "priority", "dueDate", "assigneeIds"].forEach((field) => {
      if (has(source, field)) changes[field] = source[field];
    });
  });
  if (!Object.keys(changes).length) return;

  const before = await this.model
    .findOne(this.getQuery())
    .select("status priority dueDate assigneeIds creatorId")
    .lean();
  if (!before) return;

  const entries = diffActivity(before, changes, before.creatorId);
  if (!entries.length) return;

  update.$push = { ...(update.$push || {}), activity: { $each: entries } };
  update.$set = { ...(update.$set || {}), lastActivityAt: new Date() };
  this.setUpdate(update);
});

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
