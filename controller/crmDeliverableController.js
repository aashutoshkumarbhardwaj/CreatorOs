const { CrmDeliverableContract, DEFAULT_STAGE_PROBABILITIES } = require("../model/crmDeliverableContract");
const {
  computeWeightedForecast,
  findStalledDeals,
  calculateDeliverableFulfillment,
} = require("../services/crmPipelineForecastService");

/**
 * Create a new brand sponsorship contract
 */
exports.createContract = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { brandName, campaignName, totalContractValue, currency, stage, deliverables, milestones, expectedCloseDate } =
      req.body;

    if (!brandName || !campaignName || totalContractValue === undefined) {
      return res.status(400).json({
        success: false,
        message: "brandName, campaignName, and totalContractValue are required",
      });
    }

    const currentStage = stage || "negotiation";
    const probability = DEFAULT_STAGE_PROBABILITIES[currentStage] || 50;

    const contract = new CrmDeliverableContract({
      creatorId,
      brandName,
      campaignName,
      totalContractValue: Number(totalContractValue),
      currency: currency || "USD",
      stage: currentStage,
      stageProbabilityPercent: probability,
      deliverables: deliverables || [],
      milestones: milestones || [],
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
    });

    await contract.save();

    return res.status(201).json({
      success: true,
      message: "Contract created successfully",
      contract,
    });
  } catch (error) {
    console.error("Create contract error:", error);
    return res.status(500).json({ success: false, message: "Failed to create contract", error: error.message });
  }
};

/**
 * Get all contracts for creator with optional stage filter
 */
exports.getContracts = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { stage } = req.query;

    const query = { creatorId };
    if (stage) query.stage = stage;

    const contracts = await CrmDeliverableContract.find(query).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: contracts.length,
      contracts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching contracts", error: error.message });
  }
};

/**
 * Update stage and deliverable status
 */
exports.updateStageAndDeliverables = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;
    const { stage, deliverables, milestones } = req.body;

    const contract = await CrmDeliverableContract.findOne({ _id: id, creatorId });
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    if (stage) {
      contract.stage = stage;
      contract.stageProbabilityPercent = DEFAULT_STAGE_PROBABILITIES[stage] || contract.stageProbabilityPercent;
    }
    if (deliverables && Array.isArray(deliverables)) {
      contract.deliverables = deliverables;
    }
    if (milestones && Array.isArray(milestones)) {
      contract.milestones = milestones;
    }

    await contract.save();

    const fulfillment = calculateDeliverableFulfillment(contract.deliverables);

    return res.status(200).json({
      success: true,
      message: "Contract updated successfully",
      contract,
      fulfillment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update contract", error: error.message });
  }
};

/**
 * Get weighted forecast and pipeline analytics
 */
exports.getPipelineForecastReport = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const contracts = await CrmDeliverableContract.find({ creatorId });

    const forecast = computeWeightedForecast(contracts);
    const stalled = findStalledDeals(contracts, 14);

    return res.status(200).json({
      success: true,
      forecast,
      stalledDeals: stalled,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to compute forecast", error: error.message });
  }
};
