const ContentRepurposeWorkflow = require("../model/contentRepurposeWorkflow");
const { canTransitionStage, generateRepurposedTree } = require("../services/contentWorkflowService");

/**
 * Create new workflow pipeline item
 */
exports.createPipelineItem = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { title, primaryPlatform, primaryAssetUrl, targetPublishDate, autoPopulateDerivatives } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "title is required" });
    }

    const item = new ContentRepurposeWorkflow({
      creatorId,
      title,
      primaryPlatform: primaryPlatform || "youtube_longform",
      primaryAssetUrl: primaryAssetUrl || "",
      targetPublishDate: targetPublishDate ? new Date(targetPublishDate) : null,
      derivatives: autoPopulateDerivatives ? generateRepurposedTree(title) : [],
    });

    await item.save();

    return res.status(201).json({
      success: true,
      message: "Content pipeline item created",
      item,
    });
  } catch (error) {
    console.error("Create pipeline error:", error);
    return res.status(500).json({ success: false, message: "Failed to create pipeline item", error: error.message });
  }
};

/**
 * List pipeline items for creator
 */
exports.getPipelineItems = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { stage } = req.query;

    const query = { creatorId };
    if (stage) query.approvalStage = stage;

    const items = await ContentRepurposeWorkflow.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching pipeline items", error: error.message });
  }
};

/**
 * Transition approval stage
 */
exports.transitionStage = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;
    const { nextStage, approvedBy, comments } = req.body;

    const item = await ContentRepurposeWorkflow.findOne({ _id: id, creatorId });
    if (!item) {
      return res.status(404).json({ success: false, message: "Workflow item not found" });
    }

    const check = canTransitionStage(item.approvalStage, nextStage, item.isChecklistComplete());
    if (!check.allowed) {
      return res.status(400).json({ success: false, message: check.reason });
    }

    item.approvalStage = nextStage;
    item.approvalHistory.push({
      stage: nextStage,
      approvedBy: approvedBy || "Creator",
      comments: comments || "",
      approvedAt: new Date(),
    });

    await item.save();

    return res.status(200).json({
      success: true,
      message: `Stage transitioned to ${nextStage}`,
      item,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to transition stage", error: error.message });
  }
};

/**
 * Toggle editorial checklist items
 */
exports.toggleChecklistItem = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;
    const { field, value } = req.body;

    const item = await ContentRepurposeWorkflow.findOne({ _id: id, creatorId });
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const validFields = ["audioNormalized", "thumbnailApproved", "sponsorCleared", "closedCaptionsSynced"];
    if (!validFields.includes(field)) {
      return res.status(400).json({ success: false, message: "Invalid checklist field" });
    }

    item.editorialChecklist[field] = Boolean(value);
    await item.save();

    return res.status(200).json({
      success: true,
      checklist: item.editorialChecklist,
      isComplete: item.isChecklistComplete(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating checklist", error: error.message });
  }
};

/**
 * Populate derivative repurposing tree
 */
exports.generateDerivativesForPillar = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const item = await ContentRepurposeWorkflow.findOne({ _id: id, creatorId });
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const newDerivatives = generateRepurposedTree(item.title);
    item.derivatives.push(...newDerivatives);
    await item.save();

    return res.status(200).json({
      success: true,
      message: "Repurposed derivatives generated",
      derivatives: item.derivatives,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to generate derivatives", error: error.message });
  }
};
