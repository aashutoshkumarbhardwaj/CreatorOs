jest.mock("../../model/creatorRateCard", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../model/sponsorshipScenario", () => {
  const Model = jest.fn();
  Model.find = jest.fn();
  Model.findOne = jest.fn();
  Model.findOneAndDelete = jest.fn();
  return Model;
});

const mongoose = require("mongoose");
const CreatorRateCard = require("../../model/creatorRateCard");
const SponsorshipScenario = require("../../model/sponsorshipScenario");
const {
  createScenario,
  listScenarios,
  updateScenario,
  deleteScenario,
  getProposal,
  exportProposalHtml,
} = require("../../controller/sponsorshipScenarioController");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}

function scenarioInput() {
  return {
    name: "Launch package",
    platform: "instagram",
    campaignDurationDays: 45,
    usageRightsOption: "days_90",
    exclusivityOption: "none",
    deliverables: [{ deliverableType: "reel_or_short", basePrice: 500 }],
  };
}

describe("sponsorship scenario controller", () => {
  const creatorId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates and saves a creator-owned scenario", async () => {
    const savedScenario = { save: jest.fn().mockResolvedValue(undefined) };
    SponsorshipScenario.mockImplementation(function (data) {
      Object.assign(savedScenario, data);
      return savedScenario;
    });
    const req = { user: { _id: creatorId }, body: scenarioInput() };
    const res = createResponse();

    await createScenario(req, res);

    expect(savedScenario.creatorId).toBe(creatorId);
    expect(savedScenario.quote.finalTotal).toBe(750);
    expect(savedScenario.pricingRuleVersion).toBe("1.0.0");
    expect(savedScenario.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("loads only the requesting creator's saved scenarios", async () => {
    const scenarios = [{ name: "Launch package" }];
    SponsorshipScenario.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(scenarios),
    });
    const req = { user: { id: creatorId } };
    const res = createResponse();

    await listScenarios(req, res);

    expect(SponsorshipScenario.find).toHaveBeenCalledWith({ creatorId });
    expect(res.json).toHaveBeenCalledWith({ success: true, scenarios });
  });

  it("recalculates and saves scenario edits for the owner", async () => {
    const id = new mongoose.Types.ObjectId();
    const existing = { save: jest.fn().mockResolvedValue(undefined) };
    SponsorshipScenario.findOne.mockResolvedValue(existing);
    const req = { user: { _id: creatorId }, params: { id }, body: scenarioInput() };
    const res = createResponse();

    await updateScenario(req, res);

    expect(SponsorshipScenario.findOne).toHaveBeenCalledWith({ _id: id, creatorId });
    expect(existing.quote.finalTotal).toBe(750);
    expect(existing.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("deletes a scenario only within its creator scope", async () => {
    const id = new mongoose.Types.ObjectId();
    SponsorshipScenario.findOneAndDelete.mockResolvedValue({ _id: id });
    const req = { user: { _id: creatorId }, params: { id } };
    const res = createResponse();

    await deleteScenario(req, res);

    expect(SponsorshipScenario.findOneAndDelete).toHaveBeenCalledWith({ _id: id, creatorId });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("does not let a creator price deliverables from another creator's rate card", async () => {
    CreatorRateCard.findOne.mockResolvedValue(null);
    const req = {
      user: { _id: creatorId },
      body: { ...scenarioInput(), rateCardId: new mongoose.Types.ObjectId(), deliverableIds: [new mongoose.Types.ObjectId()] },
    };
    const res = createResponse();

    await createScenario(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(SponsorshipScenario).not.toHaveBeenCalled();
  });

  it("generates a proposal from the saved scenario and creator profile", async () => {
    const id = new mongoose.Types.ObjectId();
    SponsorshipScenario.findOne.mockResolvedValue({
      name: "Launch package",
      inputs: { usageRightsOption: "days_90", exclusivityOption: "none", campaignDurationDays: 45 },
      deliverables: [{ deliverableType: "reel_or_short", basePrice: 500, description: "Launch reel" }],
      quote: { finalTotal: 750, discountPercent: 0, discountAmount: 0, usageSurcharge: 250, exclusivitySurcharge: 0, whitelistingSurcharge: 0 },
      assumptions: { currency: "USD" },
      pricingRuleVersion: "1.0.0",
    });
    const req = { user: { _id: creatorId, name: "Avery", email: "avery@example.com" }, params: { id } };
    const res = createResponse();

    await getProposal(req, res);

    expect(res.json.mock.calls[0][0].proposal).toMatchObject({
      creatorName: "Avery",
      creatorEmail: "avery@example.com",
      price: 750,
    });
    expect(res.json.mock.calls[0][0].proposal.assumptions).toContain("Pricing rule version: 1.0.0");
  });

  it("exports standalone HTML without exposing internal scenario identifiers", async () => {
    const req = { body: { proposal: { title: "Proposal", creatorName: "Avery", price: 750, currency: "USD" } } };
    const res = createResponse();

    await exportProposalHtml(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "text/html; charset=utf-8");
    expect(res.send.mock.calls[0][0]).toContain("<!doctype html>");
    expect(res.send.mock.calls[0][0]).not.toContain(String(creatorId));
  });
});