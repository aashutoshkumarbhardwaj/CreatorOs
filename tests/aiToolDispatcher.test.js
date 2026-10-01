const {
  TOOL_DEFINITIONS,
  evaluateGuardrailPolicy,
  dispatchTool,
} = require("../services/aiWorkspaceToolDispatcher");

describe("AI Workspace Tool Dispatcher & Guardrails Unit Tests", () => {
  const dummyCreatorId = "user_creator_5544";

  describe("evaluateGuardrailPolicy", () => {
    it("should flag destructive operations like delete_all or drop_db", () => {
      const violations = evaluateGuardrailPolicy("create_task", {
        title: "Clean workspace",
        command: "drop_database",
      });
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain("Destructive operation 'drop_database' is prohibited");
    });

    it("should pass safe creator workspace operations", () => {
      const violations = evaluateGuardrailPolicy("create_task", {
        title: "Review sponsorship contract with Acme",
        priority: "high",
      });
      expect(violations).toHaveLength(0);
    });
  });

  describe("dispatchTool", () => {
    it("should reject unknown tool names with policy violation", async () => {
      const result = await dispatchTool("hack_server", {}, dummyCreatorId);
      expect(result.status).toBe("rejected_by_policy");
      expect(result.policyViolations[0]).toContain("Unknown tool");
    });

    it("should reject tool call when parameter validation fails", async () => {
      const result = await dispatchTool("create_task", { title: "" }, dummyCreatorId);
      expect(result.status).toBe("validation_failed");
      expect(result.policyViolations[0]).toContain("non-empty string");
    });

    it("should successfully execute validated safe tools and return execution result", async () => {
      const result = await dispatchTool(
        "create_task",
        { title: "Record podcast episode #10", priority: "high" },
        dummyCreatorId
      );
      expect(result.status).toBe("success");
      expect(result.executionResult.action).toBe("task_created");
      expect(result.executionResult.title).toBe("Record podcast episode #10");
      expect(result.executionDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
