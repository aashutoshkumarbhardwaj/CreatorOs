const DmAutomationRule = require("../model/dmAutomationRule");
const { matchesTrigger, renderReplyTemplate, evaluateMessage } = require("../services/dmAutomationEngine");

/**
 * Create automation rule
 */
exports.createRule = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const {
      name,
      triggerKeywords,
      matchType,
      responseTemplate,
      delaySeconds,
      cooldownMinutesPerUser,
      dailySendLimit,
    } = req.body;

    if (!name || !triggerKeywords || !responseTemplate) {
      return res.status(400).json({
        success: false,
        message: "name, triggerKeywords, and responseTemplate are required",
      });
    }

    const rule = new DmAutomationRule({
      creatorId,
      name,
      triggerKeywords: Array.isArray(triggerKeywords)
        ? triggerKeywords.map((k) => k.trim().toLowerCase())
        : [triggerKeywords.trim().toLowerCase()],
      matchType: matchType || "contains",
      responseTemplate,
      delaySeconds: delaySeconds !== undefined ? Number(delaySeconds) : 2,
      cooldownMinutesPerUser: cooldownMinutesPerUser !== undefined ? Number(cooldownMinutesPerUser) : 60,
      dailySendLimit: dailySendLimit !== undefined ? Number(dailySendLimit) : 250,
    });

    await rule.save();

    return res.status(201).json({
      success: true,
      message: "DM automation rule created successfully",
      rule,
    });
  } catch (error) {
    console.error("Create rule error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create automation rule",
      error: error.message,
    });
  }
};

/**
 * Get all rules for creator
 */
exports.getRules = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const rules = await DmAutomationRule.find({ creatorId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: rules.length,
      rules,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch rules",
      error: error.message,
    });
  }
};

/**
 * Update an automation rule
 */
exports.updateRule = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const rule = await DmAutomationRule.findOne({ _id: id, creatorId });
    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    const allowed = [
      "name",
      "triggerKeywords",
      "matchType",
      "responseTemplate",
      "delaySeconds",
      "cooldownMinutesPerUser",
      "dailySendLimit",
      "status",
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "triggerKeywords" && Array.isArray(req.body[field])) {
          rule[field] = req.body[field].map((k) => k.trim().toLowerCase());
        } else {
          rule[field] = req.body[field];
        }
      }
    });

    await rule.save();

    return res.status(200).json({
      success: true,
      message: "Rule updated successfully",
      rule,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update rule",
      error: error.message,
    });
  }
};

/**
 * Delete rule
 */
exports.deleteRule = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const rule = await DmAutomationRule.findOneAndDelete({ _id: id, creatorId });
    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    return res.status(200).json({ success: true, message: "Rule deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete rule",
      error: error.message,
    });
  }
};

/**
 * Test match simulator endpoint for creator preview
 */
exports.testRuleMatch = async (req, res) => {
  try {
    const { testText, ruleId } = req.body;
    if (!testText || !ruleId) {
      return res.status(400).json({ success: false, message: "testText and ruleId are required" });
    }

    const rule = await DmAutomationRule.findById(ruleId);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    const isMatch = matchesTrigger(testText, rule);
    const previewReply = isMatch ? renderReplyTemplate(rule.responseTemplate, "TestUser") : null;

    return res.status(200).json({
      success: true,
      isMatch,
      ruleName: rule.name,
      matchType: rule.matchType,
      keywords: rule.triggerKeywords,
      previewReply,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Test evaluation failed",
      error: error.message,
    });
  }
};

/**
 * Live evaluation hook for incoming webhook events
 */
exports.processIncomingWebhookMessage = async (req, res) => {
  try {
    const { creatorId, senderId, senderName, messageText } = req.body;
    const evaluation = await evaluateMessage({ creatorId, senderId, senderName, messageText });

    return res.status(200).json({
      success: true,
      evaluation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Processing error",
      error: error.message,
    });
  }
};
