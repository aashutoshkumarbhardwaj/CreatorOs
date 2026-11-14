
const express = require("express");
const router = express.Router();

// =============================================
// MIDDLEWARE IMPORTS
// =============================================

const { protect } = require("../middleware/auth");

const {
  aiGenerationLimiter,
} = require("../middleware/rateLimiters");

const {
  validateChatRequest,
  validateToolRequest,
} = require("../middleware/aiAssistantValidator");

// =============================================
// CONTROLLER IMPORTS
// =============================================

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

// =============================================
// AUTHENTICATION
// All routes require an authenticated user.
// =============================================

router.use(protect);

// =============================================
// CONFIGURATION
// =============================================

const api = "/api";

const chatRoutes = `${api}/chats`;
const toolRoutes = `${api}/tools`;

// =============================================
// DASHBOARD ROUTE
// =============================================

/**
 * GET /
 * Render AI Creator Assistant dashboard.
 */

router.get("/", renderAssistantView);

// =============================================
// CHAT ROUTES
// =============================================

/**
 * POST /api/chat
 * Send a message to the AI assistant.
 */

router.post(
  `${api}/chat`,
  aiGenerationLimiter,
  validateChatRequest,
  sendMessage
);

/**
 * GET /api/chats
 * Retrieve current user's chat history.
 */

router.get(
  chatRoutes,
  getChats
);

/**
 * GET /api/chats/:id
 * Retrieve a specific conversation.
 */

router.get(
  `${chatRoutes}/:id`,
  getChatById
);

/**
 * DELETE /api/chats/:id
 * Delete a conversation.
 */

router.delete(
  `${chatRoutes}/:id`,
  deleteChat
);

// =============================================
// AI POWER TOOLS
// =============================================

/**
 * POST /api/tools/seo
 * Analyze content SEO.
 */

router.post(
  `${toolRoutes}/seo`,
  aiGenerationLimiter,
  validateToolRequest,
  runSeoTool
);

/**
 * POST /api/tools/predict
 * Predict content performance.
 */

router.post(
  `${toolRoutes}/predict`,
  aiGenerationLimiter,
  validateToolRequest,
  runPredictorTool
);

/**
 * POST /api/tools/hashtags
 * Generate hashtag recommendations.
 */

router.post(
  `${toolRoutes}/hashtags`,
  aiGenerationLimiter,
  validateToolRequest,
  runHashtagTool
);

/**
 * GET /api/tools/insights
 * Generate creator insights.
 */

router.get(
  `${toolRoutes}/insights`,
  runInsightsTool
);

// =============================================
// CONTENT OS INTEGRATION
// =============================================

/**
 * POST /api/export-content-os
 * Export AI-generated content to Content OS.
 */

router.post(
  `${api}/export-content-os`,
  validateToolRequest,
  exportToContentOs
);

// =============================================
// EXPORT ROUTER
// =============================================

module.exports = router;
