const AiContentDraft = require("../model/aiContentDraft");
const {
  generateViralHooks,
  generateVideoScriptOutline,
  adaptToPlatforms,
  analyzeHashtags,
} = require("../services/aiContentStudioService");

/**
 * Generate complete content bundle (hooks, script, captions, hashtags)
 */
exports.generateContentSuite = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { topic, niche = "general", tone = "informative", platforms = ["twitter", "instagram", "linkedin"] } =
      req.body;

    if (!topic) {
      return res.status(400).json({ success: false, message: "topic is required" });
    }

    const hooks = generateViralHooks(topic, niche);
    const scriptOutline = generateVideoScriptOutline(topic, tone);
    const coreMessage = `${scriptOutline.hook} ${scriptOutline.retentionBuffer} ${scriptOutline.mainPoints.join(" ")}`;
    const platformVariants = adaptToPlatforms(topic, coreMessage, platforms);
    const analyzedHashtags = analyzeHashtags(topic);

    const draft = new AiContentDraft({
      creatorId,
      topic,
      niche,
      tone,
      hooks,
      scriptOutline,
      platformVariants,
      analyzedHashtags,
    });

    await draft.save();

    return res.status(201).json({
      success: true,
      message: "AI content suite generated and saved",
      draft,
    });
  } catch (error) {
    console.error("AI studio error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate content suite",
      error: error.message,
    });
  }
};

/**
 * Generate hooks only
 */
exports.getHooksOnly = async (req, res) => {
  try {
    const { topic, niche } = req.query;
    if (!topic) {
      return res.status(400).json({ success: false, message: "topic is required" });
    }
    const hooks = generateViralHooks(topic, niche || "general");
    return res.status(200).json({ success: true, topic, hooks });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error generating hooks", error: error.message });
  }
};

/**
 * Generate script outline only
 */
exports.getScriptOnly = async (req, res) => {
  try {
    const { topic, tone } = req.query;
    if (!topic) {
      return res.status(400).json({ success: false, message: "topic is required" });
    }
    const script = generateVideoScriptOutline(topic, tone || "informative");
    return res.status(200).json({ success: true, topic, script });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error generating script", error: error.message });
  }
};

/**
 * Get creator's saved drafts
 */
exports.getSavedDrafts = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { favorite, page = 1, limit = 20 } = req.query;

    const query = { creatorId };
    if (favorite !== undefined) {
      query.isFavorite = favorite === "true";
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [drafts, total] = await Promise.all([
      AiContentDraft.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AiContentDraft.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: drafts.length,
      total,
      drafts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch drafts", error: error.message });
  }
};

/**
 * Toggle favorite on a draft
 */
exports.toggleFavorite = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const draft = await AiContentDraft.findOne({ _id: id, creatorId });
    if (!draft) {
      return res.status(404).json({ success: false, message: "Draft not found" });
    }

    draft.isFavorite = !draft.isFavorite;
    await draft.save();

    return res.status(200).json({ success: true, isFavorite: draft.isFavorite });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to toggle favorite", error: error.message });
  }
};

/**
 * Delete draft
 */
exports.deleteDraft = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const draft = await AiContentDraft.findOneAndDelete({ _id: id, creatorId });
    if (!draft) {
      return res.status(404).json({ success: false, message: "Draft not found" });
    }

    return res.status(200).json({ success: true, message: "Draft deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete draft", error: error.message });
  }
};
