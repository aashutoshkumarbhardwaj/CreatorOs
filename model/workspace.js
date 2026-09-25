const mongoose = require("mongoose");

const ROLES = ["owner", "admin", "member", "guest"];

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ROLES,
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/** Projects live inside their workspace; tasks reference them by _id. */
const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    color: {
      type: String,
      trim: true,
      default: "#8b5cf6",
    },
    status: {
      type: String,
      enum: ["active", "on_hold", "completed", "archived"],
      default: "active",
    },
    // Can lower a member's access for this project, never raise it.
    memberOverrides: [memberSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

/**
 * @schema workspaceSchema
 * @description Team container for projects and tasks. Tasks with no workspace
 * remain personal, so existing single-user tasks are unaffected.
 */
const workspaceSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    icon: {
      type: String,
      trim: true,
      default: "🗂️",
    },
    members: [memberSchema],
    projects: [projectSchema],
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Membership lookups run on nearly every workspace-scoped task request.
workspaceSchema.index({ "members.userId": 1, isArchived: 1 });

const Workspace =
  mongoose.models.Workspace || mongoose.model("Workspace", workspaceSchema);

module.exports = Workspace;
module.exports.ROLES = ROLES;
