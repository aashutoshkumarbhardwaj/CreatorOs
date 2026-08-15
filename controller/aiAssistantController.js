const { v4: uuidv4 } = require("crypto");
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

/**
 * GET /services/ai-assistant
 * Renders the AI Creator Assistant dashboard view.
 */
const renderAssistantView = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  let chats = [];

  if (userId) {
    chats = await AssistantChat.find({ userId })
      .select("title platform tone updatedAt")
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
  }

  const initialInsights = generateCreatorInsights({
    niche: req.user?.bio || "Digital Creator",
  });

  res.render("ai-assistant", {
    title: "🤖 AI Creator Assistant - CreatorOS",
    activeNav: "ai-assistant",
    user: req.user || { name: "Creator" },
    services,
    chats,
    initialInsights,
    csrfToken: req.csrfToken ? req.csrfToken() : "",
  });
});

/**
 * POST /api/ai-assistant/chat
 * Handles multi-turn chat messages with AI & updates AssistantChat session.
 */
const sendMessage = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { prompt, platform, tone, chatId } = req.validatedBody || req.body;

  let chatDoc = null;
  if (chatId) {
    chatDoc = await AssistantChat.findOne({ _id: chatId, userId });
  }

  if (!chatDoc) {
    const titleSnippet = prompt.slice(0, 40) + (prompt.length > 40 ? "..." : "");
    chatDoc = new AssistantChat({
      userId,
      title: titleSnippet,
      platform: platform || "general",
      tone: tone || "energetic",
      messages: [],
    });
  }

  // User message
  const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  chatDoc.messages.push({
    messageId: userMessageId,
    role: "user",
    content: prompt,
    createdAt: new Date(),
  });

  // Generate AI Response
  const aiResult = await generateConversationalResponse({
    prompt,
    platform: chatDoc.platform,
    tone: chatDoc.tone,
    history: chatDoc.messages,
  });

  // Assistant message
  const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const assistantMsg = {
    messageId: assistantMessageId,
    role: "assistant",
    content: aiResult.content,
    structuredData: {
      suggestions: aiResult.suggestions,
      seoScore: aiResult.seoScore,
      viralityScore: aiResult.viralityScore,
      keywords: aiResult.keywords,
      hashtags: aiResult.hashtags,
      ctas: aiResult.ctas,
    },
    createdAt: new Date(),
  };

  chatDoc.messages.push(assistantMsg);
  await chatDoc.save();

  return res.json({
    success: true,
    data: {
      chatId: chatDoc._id,
      title: chatDoc.title,
      message: assistantMsg,
    },
  });
});

/**
 * GET /api/ai-assistant/chats
 * Retrieves all chat threads for the current user.
 */
const getChats = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const chats = await AssistantChat.find({ userId })
    .select("title platform tone updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  return res.json({ success: true, data: chats });
});

/**
 * GET /api/ai-assistant/chats/:id
 * Retrieves a specific chat thread.
 */
const getChatById = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const chat = await AssistantChat.findOne({ _id: req.params.id, userId }).lean();

  if (!chat) {
    return res.status(404).json({ success: false, message: "Chat thread not found" });
  }

  return res.json({ success: true, data: chat });
});

/**
 * DELETE /api/ai-assistant/chats/:id
 * Deletes a chat thread.
 */
const deleteChat = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const result = await AssistantChat.deleteOne({ _id: req.params.id, userId });

  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: "Chat thread not found" });
  }

  return res.json({ success: true, message: "Chat thread deleted successfully" });
});

/**
 * POST /api/ai-assistant/tools/seo
 */
const runSeoTool = asyncHandler(async (req, res) => {
  const { text, platform } = req.validatedBody || req.body;
  const analysis = analyzeContentSeo(text, platform);
  return res.json({ success: true, data: analysis });
});

/**
 * POST /api/ai-assistant/tools/predict
 */
const runPredictorTool = asyncHandler(async (req, res) => {
  const { text, platform } = req.validatedBody || req.body;
  const prediction = predictContentPerformance(text, platform);
  return res.json({ success: true, data: prediction });
});

/**
 * POST /api/ai-assistant/tools/hashtags
 */
const runHashtagTool = asyncHandler(async (req, res) => {
  const { text, platform } = req.validatedBody || req.body;
  const matrix = generateHashtagMatrix(text, platform);
  return res.json({ success: true, data: matrix });
});

/**
 * GET /api/ai-assistant/tools/insights
 */
const runInsightsTool = asyncHandler(async (req, res) => {
  const insights = generateCreatorInsights({ niche: req.user?.bio || "Digital Creator" });
  return res.json({ success: true, data: insights });
});

/**
 * POST /api/ai-assistant/export-content-os
 * Exports an AI assistant recommendation directly into Content OS.
 */
const exportToContentOs = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { title, description, platform, type } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, message: "Title is required to save to Content OS" });
  }

  const newContentItem = new ContentOs({
    userId,
    title: title.slice(0, 100),
    description: description || "",
    type: type || "idea",
    status: "idea",
    platform: platform || "general",
    priority: "medium",
  });

  await newContentItem.save();

  return res.json({
    success: true,
    message: "Successfully exported to Content OS!",
    data: newContentItem,
  });
});

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
