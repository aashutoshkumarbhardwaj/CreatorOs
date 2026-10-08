const mongoose = require("mongoose");

const dmAutomationRuleSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    triggerKeywords: [
      {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
    ],
    matchType: {
      type: String,
      enum: ["exact", "contains", "regex"],
      default: "contains",
    },
    responseTemplate: {
      type: String,
      required: true,
      trim: true,
    },
    delaySeconds: {
      type: Number,
      min: 0,
      max: 300,
      default: 2,
    },
    cooldownMinutesPerUser: {
      type: Number,
      min: 1,
      max: 1440,
      default: 60,
    },
    dailySendLimit: {
      type: Number,
      min: 1,
      default: 250,
    },
    currentDayStats: {
      date: { type: String, default: () => new Date().toISOString().split("T")[0] },
      sendsToday: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["active", "paused", "archived"],
      default: "active",
      index: true,
    },
    totalTriggeredCount: {
      type: Number,
      default: 0,
    },
    totalSentCount: {
      type: Number,
      default: 0,
    },
    lastTriggeredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

dmAutomationRuleSchema.methods.canSendToday = function () {
  const today = new Date().toISOString().split("T")[0];
  if (this.currentDayStats.date !== today) {
    this.currentDayStats.date = today;
    this.currentDayStats.sendsToday = 0;
  }
  return this.currentDayStats.sendsToday < this.dailySendLimit;
};

dmAutomationRuleSchema.methods.recordSend = function () {
  const today = new Date().toISOString().split("T")[0];
  if (this.currentDayStats.date !== today) {
    this.currentDayStats.date = today;
    this.currentDayStats.sendsToday = 0;
  }
  this.currentDayStats.sendsToday += 1;
  this.totalSentCount += 1;
  this.totalTriggeredCount += 1;
  this.lastTriggeredAt = new Date();
};

const DmAutomationRule = mongoose.model("DmAutomationRule", dmAutomationRuleSchema);

module.exports = DmAutomationRule;
