const mongoose = require("mongoose");

const aiToolExecutionLogSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toolName: {
      type: String,
      required: true,
      index: true,
    },
    intent: {
      type: String,
      default: "",
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["success", "rejected_by_policy", "validation_failed", "failed"],
      required: true,
      index: true,
    },
    policyViolations: [
      {
        type: String,
      },
    ],
    executionResult: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    executionDurationMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const AiToolExecutionLog = mongoose.model("AiToolExecutionLog", aiToolExecutionLogSchema);

module.exports = AiToolExecutionLog;
