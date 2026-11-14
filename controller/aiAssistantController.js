
const crypto = require("crypto");
const mongoose = require("mongoose");

const asyncHandler = require("../utils/asyncHandler");
const services = require("../services.config");

const AssistantChat = require("../model/assistantChat");
const ContentOs = require("../model/contentOs");

const {
  generateConversationalResponse,
  analyzeContentSeo,
  predictContentPerformance,
  generateHashtagMatrix,
  generateCreatorInsights,
} = require("../services/aiAssistantService");

// =============================================
// CONFIGURATION
// =============================================

const DEFAULTS = {
  platform: "general",
  tone: "energetic",
  length: "medium",
  niche: "Digital Creator",
};

const LIMITS = {
  PROMPT: 10000,
  TITLE: 100,
  DESCRIPTION: 5000,
  CHAT_LIST: 50,
  HISTORY: 40,
};

// =============================================
// SHARED HELPERS
// =============================================

const getUserId = (req) => {
  return req.user?.id || req.user?._id || null;
};

const isValidUserId = (userId) => {
  return Boolean(userId && mongoose.Types.ObjectId.isValid(userId));
};

const sendError = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

const getBody = (req) => {
  return req.validatedBody || req.body || {};
};

const generateMessageId = () => {
  return `msg_${crypto.randomUUID()}`;
};

const getCreatorNiche = (req) => {
  return req.user?.bio?.trim() || DEFAULTS.niche;
};

const validateText = (value, maxLength) => {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
};

const validateChatId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const normalizeOption = (value, fallback) => {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
};

// =============================================
// RENDER ASSISTANT DASHBOARD
// =============================================

/**
 * GET /services/ai-assistant
 *
 * Renders the AI Creator Assistant dashboard.
 */

const renderAssistantView = asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  let chats = [];

  if (isValidUserId(userId)) {
    chats = await AssistantChat.find({ userId })
      .select("title platform tone length updatedAt")
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
  }

  const initialInsights = generateCreatorInsights({
    niche: getCreatorNiche(req),
  });

  return res.render("ai-assistant", {
    title: "🤖 AI Creator Assistant - CreatorOS",
    activeNav: "ai-assistant",
    user: req.user || { name: "Creator" },
    services,
    chats,
    initialInsights,
    csrfToken: req.csrfToken?.() || "",
  });
});

// =============================================
// SEND CHAT MESSAGE
// =============================================

/**
 * POST /api/ai-assistant/chat
 *
 * Handles AI conversations and persists chat history.
 */

const sendMessage = asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (!isValidUserId(userId)) {
    return sendError(res, 401, "Authentication required");
  }

  const {
    prompt,
    platform,
    tone,
    length,
    chatId,
  } = getBody(req);

  // Validate prompt
  if (!validateText(prompt, LIMITS.PROMPT)) {
    return sendError(
      res,
      400,
      `Prompt must contain 1-${LIMITS.PROMPT} characters`
    );
  }

  // Validate chat ID
  if (chatId && !validateChatId(chatId)) {
    return sendError(res, 400, "Invalid chat ID");
  }

  let chatDoc;

  // -------------------------------------------
  // Find existing conversation
  // -------------------------------------------

  if (chatId) {
    chatDoc = await AssistantChat.findOne({
      _id: chatId,
      userId,
    });

    // Never silently create a new chat for an
    // invalid or unauthorized existing chat ID.
    if (!chatDoc) {
      return sendError(res, 404, "Chat thread not found");
    }
  } else {
    const cleanPrompt = prompt.trim();

    chatDoc = new AssistantChat({
      userId,
      title:
        cleanPrompt.slice(0, 40) +
        (cleanPrompt.length > 40 ? "..." : ""),
      platform: normalizeOption(platform, DEFAULTS.platform),
      tone: normalizeOption(tone, DEFAULTS.tone),
      length: normalizeOption(length, DEFAULTS.length),
      messages: [],
    });
  }

  // -------------------------------------------
  // Prepare conversation history
  // -------------------------------------------

  const previousHistory = chatDoc.messages.map((message) => ({
    messageId: message.messageId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));

  const userMessage = {
    messageId: generateMessageId(),
    role: "user",
    content: prompt.trim(),
    createdAt: new Date(),
  };

  // Add user message
  chatDoc.messages.push(userMessage);

  // -------------------------------------------
  // Generate AI response
  // -------------------------------------------

  const aiResult = await generateConversationalResponse({
    prompt: prompt.trim(),
    platform: normalizeOption(
      platform,
      chatDoc.platform || DEFAULTS.platform
    ),
    tone: normalizeOption(
      tone,
      chatDoc.tone || DEFAULTS.tone
    ),
    length: normalizeOption(
      length,
      chatDoc.length || DEFAULTS.length
    ),
    history: previousHistory.slice(-LIMITS.HISTORY),
  });

  if (!aiResult || typeof aiResult.content !== "string") {
    throw new Error("AI service returned an invalid response");
  }

  // -------------------------------------------
  // Prepare assistant response
  // -------------------------------------------

  const assistantMessage = {
    messageId: generateMessageId(),
    role: "assistant",
    content: aiResult.content,
    structuredData: {
      suggestions: aiResult.suggestions || [],
      seoScore: aiResult.seoScore ?? null,
      viralityScore: aiResult.viralityScore ?? null,
      keywords: aiResult.keywords || [],
      hashtags: aiResult.hashtags || [],
      ctas: aiResult.ctas || [],
    },
    createdAt: new Date(),
  };

  chatDoc.messages.push(assistantMessage);

  // Update conversation preferences
  chatDoc.platform = normalizeOption(
    platform,
    chatDoc.platform || DEFAULTS.platform
  );

  chatDoc.tone = normalizeOption(
    tone,
    chatDoc.tone || DEFAULTS.tone
  );

  chatDoc.length = normalizeOption(
    length,
    chatDoc.length || DEFAULTS.length
  );

  await chatDoc.save();

  return res.status(200).json({
    success: true,
    data: {
      chatId: chatDoc._id,
      title: chatDoc.title,
      message: assistantMessage,
    },
  });
});

// =============================================
// GET ALL CHATS
// =============================================

/**
 * GET /api/ai-assistant/chats
 */

const getChats = asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (!isValidUserId(userId)) {
    return sendError(res, 401, "Authentication required");
  }

  const chats = await AssistantChat.find({ userId })
    .select("title platform tone length updatedAt")
    .sort({ updatedAt: -1 })
    .limit(LIMITS.CHAT_LIST)
    .lean();

  return res.json({
    success: true,
    count: chats.length,
    data: chats,
  });
});

// =============================================
// GET CHAT BY ID
// =============================================

/**
 * GET /api/ai-assistant/chats/:id
 */

const getChatById = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!isValidUserId(userId)) {
    return sendError(res, 401, "Authentication required");
  }

  if (!validateChatId(id)) {
    return sendError(res, 400, "Invalid chat ID");
  }

  const chat = await AssistantChat.findOne({
    _id: id,
    userId,
  }).lean();

  if (!chat) {
    return sendError(res, 404, "Chat thread not found");
  }

  return res.json({
    success: true,
    data: chat,
  });
});

// =============================================
// DELETE CHAT
// =============================================

/**
 * DELETE /api/ai-assistant/chats/:id
 */

const deleteChat = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!isValidUserId(userId)) {
    return sendError(res, 401, "Authentication required");
  }

  if (!validateChatId(id)) {
    return sendError(res, 400, "Invalid chat ID");
  }

  const result = await AssistantChat.deleteOne({
    _id: id,
    userId,
  });

  if (result.deletedCount === 0) {
    return sendError(res, 404, "Chat thread not found");
  }

  return res.json({
    success: true,
    message: "Chat thread deleted successfully",
  });
});

// =============================================
// SEO ANALYSIS TOOL
// =============================================

/**
 * POST /api/ai-assistant/tools/seo
 */

const runSeoTool = asyncHandler(async (req, res) => {
  const { text, platform } = getBody(req);

  if (!validateText(text, LIMITS.PROMPT)) {
    return sendError(res, 400, "Valid content text is required");
  }

  const analysis = analyzeContentSeo(
    text.trim(),
    normalizeOption(platform, DEFAULTS.platform)
  );

  return res.json({
    success: true,
    data: analysis,
  });
});

// =============================================
// CONTENT PERFORMANCE PREDICTOR
// =============================================

/**
 * POST /api/ai-assistant/tools/predict
 */

const runPredictorTool = asyncHandler(async (req, res) => {
  const { text, platform } = getBody(req);

  if (!validateText(text, LIMITS.PROMPT)) {
    return sendError(res, 400, "Valid content text is required");
  }

  const prediction = predictContentPerformance(
    text.trim(),
    normalizeOption(platform, DEFAULTS.platform)
  );

  return res.json({
    success: true,
    data: prediction,
  });
});

// =============================================
// HASHTAG GENERATOR
// =============================================

/**
 * POST /api/ai-assistant/tools/hashtags
 */

const runHashtagTool = asyncHandler(async (req, res) => {
  const { text, platform } = getBody(req);

  if (!validateText(text, LIMITS.PROMPT)) {
    return sendError(res, 400, "Valid content text is required");
  }

  const matrix = generateHashtagMatrix(
    text.trim(),
    normalizeOption(platform, DEFAULTS.platform)
  );

  return res.json({
    success: true,
    data: matrix,
  });
});

// =============================================
// CREATOR INSIGHTS
// =============================================

/**
 * GET /api/ai-assistant/tools/insights
 */

const runInsightsTool = asyncHandler(async (req, res) => {
  const insights = generateCreatorInsights({
    niche: getCreatorNiche(req),
  });

  return res.json({
    success: true,
    data: insights,
  });
});

// =============================================
// EXPORT TO CONTENT OS
// =============================================

/**
 * POST /api/ai-assistant/export-content-os
 */

const exportToContentOs = asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (!isValidUserId(userId)) {
    return sendError(res, 401, "Authentication required");
  }

  const {
    title,
    description,
    platform,
    type,
  } = getBody(req);

  if (!validateText(title, LIMITS.TITLE)) {
    return sendError(
      res,
      400,
      `Title must contain 1-${LIMITS.TITLE} characters`
    );
  }

  if (
    description !== undefined &&
    (typeof description !== "string" ||
      description.length > LIMITS.DESCRIPTION)
  ) {
    return sendError(res, 400, "Invalid description");
  }

  const allowedTypes = ["idea", "post", "video", "article"];

  const contentType = normalizeOption(type, "idea");

  if (!allowedTypes.includes(contentType)) {
    return sendError(res, 400, "Invalid content type");
  }

  const newContentItem = await ContentOs.create({
    userId,
    title: title.trim(),
    description: description?.trim() || "",
    type: contentType,
    status: "idea",
    platform: normalizeOption(platform, DEFAULTS.platform),
    priority: "medium",
  });

  return res.status(201).json({
    success: true,
    message: "Successfully exported to Content OS!",
    data: newContentItem,
  });
});

// =============================================
// EXPORT CONTROLLERS
// =============================================

module.exports = {
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
};
