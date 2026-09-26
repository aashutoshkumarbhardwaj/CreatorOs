const CreatorRateCard = require("../model/creatorRateCard");
const { calculateBaselineRate, calculateSponsorshipQuote } = require("../services/rateCardEngine");

function createSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-");
}

/**
 * Create rate card
 */
exports.createRateCard = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const {
      title,
      niche,
      currency,
      deliverables,
      twoDeliverableBundleDiscountPercent,
      threePlusBundleDiscountPercent,
      isPublic,
      contactEmail,
      notes,
    } = req.body;

    if (!title || !deliverables || deliverables.length === 0) {
      return res.status(400).json({
        success: false,
        message: "title and at least one deliverable are required",
      });
    }

    let baseSlug = createSlug(title) || "rate-card";
    let slug = baseSlug;
    let counter = 1;
    while (await CreatorRateCard.findOne({ creatorId, slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const card = new CreatorRateCard({
      creatorId,
      title,
      slug,
      niche: niche || "tech",
      currency: currency || "USD",
      deliverables,
      twoDeliverableBundleDiscountPercent:
        twoDeliverableBundleDiscountPercent !== undefined ? twoDeliverableBundleDiscountPercent : 10,
      threePlusBundleDiscountPercent:
        threePlusBundleDiscountPercent !== undefined ? threePlusBundleDiscountPercent : 20,
      isPublic: isPublic !== undefined ? isPublic : true,
      contactEmail: contactEmail || "",
      notes: notes || undefined,
    });

    await card.save();

    return res.status(201).json({
      success: true,
      message: "Rate card created successfully",
      card,
    });
  } catch (error) {
    console.error("Create rate card error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create rate card",
      error: error.message,
    });
  }
};

/**
 * Get all rate cards for creator
 */
exports.getRateCards = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const cards = await CreatorRateCard.find({ creatorId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: cards.length,
      cards,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch rate cards",
      error: error.message,
    });
  }
};

/**
 * Get public rate card by slug
 */
exports.getPublicRateCard = async (req, res) => {
  try {
    const { slug } = req.params;
    const card = await CreatorRateCard.findOne({ slug, isPublic: true });
    if (!card) {
      return res.status(404).json({ success: false, message: "Public rate card not found" });
    }

    return res.status(200).json({ success: true, card });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching rate card", error: error.message });
  }
};

/**
 * Update rate card
 */
exports.updateRateCard = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const card = await CreatorRateCard.findOne({ _id: id, creatorId });
    if (!card) {
      return res.status(404).json({ success: false, message: "Rate card not found" });
    }

    const fields = [
      "title",
      "niche",
      "currency",
      "deliverables",
      "twoDeliverableBundleDiscountPercent",
      "threePlusBundleDiscountPercent",
      "isPublic",
      "contactEmail",
      "notes",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        card[f] = req.body[f];
      }
    });

    if (req.body.title && req.body.title !== card.title) {
      card.slug = createSlug(req.body.title);
    }

    await card.save();

    return res.status(200).json({
      success: true,
      message: "Rate card updated successfully",
      card,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update rate card",
      error: error.message,
    });
  }
};

/**
 * Delete rate card
 */
exports.deleteRateCard = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const card = await CreatorRateCard.findOneAndDelete({ _id: id, creatorId });
    if (!card) {
      return res.status(404).json({ success: false, message: "Rate card not found" });
    }

    return res.status(200).json({ success: true, message: "Rate card deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete rate card",
      error: error.message,
    });
  }
};

/**
 * Interactive quote calculator simulation
 */
exports.calculateQuote = async (req, res) => {
  try {
    const {
      deliverables,
      usageRightsOption,
      exclusivityOption,
      whitelistingAllowed,
      twoDiscountPercent,
      threePlusDiscountPercent,
    } = req.body;

    const quote = calculateSponsorshipQuote({
      deliverables,
      usageRightsOption,
      exclusivityOption,
      whitelistingAllowed,
      twoDiscountPercent,
      threePlusDiscountPercent,
    });

    return res.status(200).json({
      success: true,
      quote,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to compute quote",
      error: error.message,
    });
  }
};

/**
 * Estimate baseline rates for creator
 */
exports.estimateBaseline = async (req, res) => {
  try {
    const { niche, estimatedViews, engagementRatePercent } = req.query;
    const rate = calculateBaselineRate({
      niche: niche || "tech",
      estimatedViews: Number(estimatedViews) || 10000,
      engagementRatePercent: Number(engagementRatePercent) || 4.0,
    });

    return res.status(200).json({
      success: true,
      niche: niche || "tech",
      estimatedViews: Number(estimatedViews) || 10000,
      engagementRatePercent: Number(engagementRatePercent) || 4.0,
      estimatedBaselineRate: rate,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to estimate baseline",
      error: error.message,
    });
  }
};
