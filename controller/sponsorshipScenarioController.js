const mongoose = require("mongoose");
const CreatorRateCard = require("../model/creatorRateCard");
const SponsorshipScenario = require("../model/sponsorshipScenario");
const {
  normalizeScenarioInput,
  buildProposal,
  renderProposalHtml,
} = require("../services/sponsorshipScenarioService");

function creatorIdFromRequest(req) {
  return req.user?._id || req.user?.id || req.user;
}

function sendError(res, error, fallbackMessage) {
  const status = error.statusCode || (error.name === "ValidationError" ? 400 : 500);
  return res.status(status).json({
    success: false,
    message: status === 500 ? fallbackMessage : error.message,
  });
}

async function findOwnedRateCard(rateCardId, creatorId) {
  if (!rateCardId) return null;
  if (!mongoose.Types.ObjectId.isValid(rateCardId)) {
    const error = new Error("Invalid rate card id");
    error.statusCode = 400;
    throw error;
  }
  const rateCard = await CreatorRateCard.findOne({ _id: rateCardId, creatorId });
  if (!rateCard) {
    const error = new Error("Rate card not found");
    error.statusCode = 404;
    throw error;
  }
  return rateCard;
}

exports.listScenarios = async (req, res) => {
  try {
    const scenarios = await SponsorshipScenario.find({ creatorId: creatorIdFromRequest(req) }).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, scenarios });
  } catch (error) {
    return sendError(res, error, "Failed to load sponsorship scenarios");
  }
};

exports.createScenario = async (req, res) => {
  try {
    const creatorId = creatorIdFromRequest(req);
    const rateCard = await findOwnedRateCard(req.body.rateCardId, creatorId);
    const scenario = new SponsorshipScenario({
      creatorId,
      ...normalizeScenarioInput(req.body, rateCard),
    });
    await scenario.save();
    return res.status(201).json({ success: true, scenario });
  } catch (error) {
    return sendError(res, error, "Failed to create sponsorship scenario");
  }
};

exports.updateScenario = async (req, res) => {
  try {
    const creatorId = creatorIdFromRequest(req);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ success: false, message: "Scenario not found" });
    const scenario = await SponsorshipScenario.findOne({ _id: id, creatorId });
    if (!scenario) return res.status(404).json({ success: false, message: "Scenario not found" });

    const rateCard = await findOwnedRateCard(req.body.rateCardId, creatorId);
    Object.assign(scenario, normalizeScenarioInput(req.body, rateCard));
    await scenario.save();
    return res.status(200).json({ success: true, scenario });
  } catch (error) {
    return sendError(res, error, "Failed to update sponsorship scenario");
  }
};

exports.deleteScenario = async (req, res) => {
  try {
    const creatorId = creatorIdFromRequest(req);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ success: false, message: "Scenario not found" });
    const scenario = await SponsorshipScenario.findOneAndDelete({ _id: id, creatorId });
    if (!scenario) return res.status(404).json({ success: false, message: "Scenario not found" });
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendError(res, error, "Failed to delete sponsorship scenario");
  }
};

exports.getProposal = async (req, res) => {
  try {
    const creatorId = creatorIdFromRequest(req);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ success: false, message: "Scenario not found" });
    const scenario = await SponsorshipScenario.findOne({ _id: id, creatorId });
    if (!scenario) return res.status(404).json({ success: false, message: "Scenario not found" });
    return res.status(200).json({
      success: true,
      proposal: buildProposal(scenario, { name: req.user?.name, email: req.user?.email }),
    });
  } catch (error) {
    return sendError(res, error, "Failed to generate proposal");
  }
};

exports.exportProposalHtml = async (req, res) => {
  if (!req.body.proposal || typeof req.body.proposal !== "object" || Array.isArray(req.body.proposal)) {
    return res.status(400).json({ success: false, message: "Proposal content is required" });
  }
  const html = renderProposalHtml(req.body.proposal);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="creatoros-proposal.html"');
  return res.status(200).send(html);
};