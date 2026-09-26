/**
 * Safe AI Workspace Tool Dispatcher
 * Provides JSON Schema validation, guardrail policy enforcement, and sandboxed tool execution
 */

const FORBIDDEN_KEYWORDS = ["delete_all", "drop_db", "drop_database", "revoke_admin", "purge_all_users", "eval"];

const TOOL_DEFINITIONS = {
  create_task: {
    description: "Create a new task in the creator workspace",
    requiredParams: ["title"],
    validator: (params) => {
      const errors = [];
      if (!params.title || typeof params.title !== "string" || params.title.trim().length === 0) {
        errors.push("Parameter 'title' must be a non-empty string.");
      }
      if (params.priority && !["low", "medium", "high", "urgent"].includes(params.priority)) {
        errors.push("Parameter 'priority' must be one of: low, medium, high, urgent.");
      }
      return errors;
    },
    execute: async (params, creatorId) => {
      return {
        action: "task_created",
        taskId: `mock_task_${Date.now()}`,
        title: params.title.trim(),
        priority: params.priority || "medium",
        creatorId,
      };
    },
  },

  schedule_content: {
    description: "Schedule a social media post across platforms",
    requiredParams: ["platform", "caption", "scheduledTime"],
    validator: (params) => {
      const errors = [];
      const validPlatforms = ["instagram", "youtube", "tiktok", "twitter", "linkedin"];
      if (!validPlatforms.includes(params.platform)) {
        errors.push(`Invalid platform. Allowed: ${validPlatforms.join(", ")}`);
      }
      if (!params.caption || typeof params.caption !== "string") {
        errors.push("Caption is required and must be text.");
      }
      const date = new Date(params.scheduledTime);
      if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        errors.push("scheduledTime must be a valid future ISO timestamp.");
      }
      return errors;
    },
    execute: async (params, creatorId) => {
      return {
        action: "content_scheduled",
        jobId: `sched_${Date.now()}`,
        platform: params.platform,
        scheduledFor: params.scheduledTime,
        creatorId,
      };
    },
  },

  draft_email_broadcast: {
    description: "Draft an audience email broadcast campaign",
    requiredParams: ["subject", "previewText"],
    validator: (params) => {
      const errors = [];
      if (!params.subject || params.subject.trim().length === 0) {
        errors.push("subject is required");
      }
      return errors;
    },
    execute: async (params, creatorId) => {
      return {
        action: "broadcast_drafted",
        campaignId: `camp_${Date.now()}`,
        subject: params.subject.trim(),
        creatorId,
      };
    },
  },
};

/**
 * Validate guardrails: checks against destructive actions or injections
 */
function evaluateGuardrailPolicy(toolName, params) {
  const violations = [];

  const serialized = JSON.stringify(params).toLowerCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (serialized.includes(keyword) || toolName.toLowerCase().includes(keyword)) {
      violations.push(`Guardrail violation: Destructive operation '${keyword}' is prohibited.`);
    }
  }

  return violations;
}

/**
 * Execute tool safely with guardrails and timing
 */
async function dispatchTool(toolName, params = {}, creatorId) {
  const startTime = Date.now();

  // 1. Check tool existence
  const tool = TOOL_DEFINITIONS[toolName];
  if (!tool) {
    return {
      status: "rejected_by_policy",
      policyViolations: [`Unknown tool '${toolName}'. Tool is not in registered capability set.`],
      executionDurationMs: Date.now() - startTime,
    };
  }

  // 2. Check security guardrail policy
  const guardrailViolations = evaluateGuardrailPolicy(toolName, params);
  if (guardrailViolations.length > 0) {
    return {
      status: "rejected_by_policy",
      policyViolations: guardrailViolations,
      executionDurationMs: Date.now() - startTime,
    };
  }

  // 3. Check JSON schema parameters
  const schemaErrors = tool.validator(params);
  if (schemaErrors.length > 0) {
    return {
      status: "validation_failed",
      policyViolations: schemaErrors,
      executionDurationMs: Date.now() - startTime,
    };
  }

  // 4. Sandboxed execution
  try {
    const result = await tool.execute(params, creatorId);
    return {
      status: "success",
      policyViolations: [],
      executionResult: result,
      executionDurationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: "failed",
      policyViolations: [error.message],
      executionDurationMs: Date.now() - startTime,
    };
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  evaluateGuardrailPolicy,
  dispatchTool,
};
