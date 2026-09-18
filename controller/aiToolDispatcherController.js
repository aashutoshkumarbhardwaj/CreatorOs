const AiToolExecutionLog = require("../model/aiToolExecutionLog");
const { TOOL_DEFINITIONS, dispatchTool } = require("../services/aiWorkspaceToolDispatcher");

/**
 * Execute tool action through safe dispatcher
 */
exports.executeToolAction = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { toolName, parameters, intent } = req.body;

    if (!toolName) {
      return res.status(400).json({ success: false, message: "toolName is required" });
    }

    const outcome = await dispatchTool(toolName, parameters || {}, creatorId);

    // Persist immutable audit log
    const log = new AiToolExecutionLog({
      creatorId,
      toolName,
      intent: intent || "",
      parameters: parameters || {},
      status: outcome.status,
      policyViolations: outcome.policyViolations || [],
      executionResult: outcome.executionResult || {},
      executionDurationMs: outcome.executionDurationMs,
    });
    await log.save();

    const httpStatus = outcome.status === "success" ? 200 : outcome.status === "validation_failed" ? 400 : 422;

    return res.status(httpStatus).json({
      success: outcome.status === "success",
      status: outcome.status,
      policyViolations: outcome.policyViolations,
      result: outcome.executionResult,
      executionDurationMs: outcome.executionDurationMs,
      logId: log._id,
    });
  } catch (error) {
    console.error("AI Dispatcher error:", error);
    return res.status(500).json({ success: false, message: "Dispatcher execution error", error: error.message });
  }
};

/**
 * Discovery endpoint for registered tools and schemas
 */
exports.getRegisteredTools = async (req, res) => {
  try {
    const tools = Object.keys(TOOL_DEFINITIONS).map((name) => ({
      name,
      description: TOOL_DEFINITIONS[name].description,
      requiredParams: TOOL_DEFINITIONS[name].requiredParams,
    }));

    return res.status(200).json({
      success: true,
      count: tools.length,
      tools,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch tools", error: error.message });
  }
};

/**
 * Get creator's AI tool execution audit history
 */
exports.getAuditHistory = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { status, toolName, page = 1, limit = 25 } = req.query;

    const query = { creatorId };
    if (status) query.status = status;
    if (toolName) query.toolName = toolName;

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AiToolExecutionLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AiToolExecutionLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      logs,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch audit history", error: error.message });
  }
};
