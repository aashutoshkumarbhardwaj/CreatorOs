const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createRule,
  getRules,
  updateRule,
  deleteRule,
  testRuleMatch,
  processIncomingWebhookMessage,
} = require("../controller/dmAutomationController");

// Webhook evaluation endpoint (internal or service key guarded)
router.post("/evaluate", processIncomingWebhookMessage);

// Creator protected routes
router.use(protect);
router.get("/rules", getRules);
router.post("/rules", createRule);
router.put("/rules/:id", updateRule);
router.delete("/rules/:id", deleteRule);
router.post("/rules/test-match", testRuleMatch);

module.exports = router;
