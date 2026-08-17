const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { aiGenerationLimiter } = require("../middleware/rateLimiters");
const {
  validateChatRequest,
  validateToolRequest,
} = require("../middleware/aiAssistantValidator");
const {
  renderAssistantView,
  sendMessage,
  getChats,
  getChatById,
  deleteChat,
  runSeoTool,
  runPredictorTool,
  runHashtagTool,
  runInsightsTool,
  exportToContentOs,
} = require("../controller/aiAssistantController");

// Render Assistant Page
router.get("/", protect, renderAssistantView);

// Chat endpoints
router.post("/api/chat", protect, aiGenerationLimiter, validateChatRequest, sendMessage);
router.get("/api/chats", protect, getChats);
router.get("/api/chats/:id", protect, getChatById);
router.delete("/api/chats/:id", protect, deleteChat);

// AI Power Tool endpoints
router.post("/api/tools/seo", protect, validateToolRequest, runSeoTool);
router.post("/api/tools/predict", protect, validateToolRequest, runPredictorTool);
router.post("/api/tools/hashtags", protect, validateToolRequest, runHashtagTool);
router.get("/api/tools/insights", protect, runInsightsTool);

// Content OS Integration
router.post("/api/export-content-os", protect, exportToContentOs);

module.exports = router;
