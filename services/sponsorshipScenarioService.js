const {
  PRICING_RULE_VERSION,
  USAGE_RIGHTS_MULTIPLIERS,
  EXCLUSIVITY_MULTIPLIERS,
  calculateSponsorshipQuote,
} = require("./rateCardEngine");

const PLATFORMS = ["youtube", "instagram", "tiktok", "twitter", "podcast", "newsletter"];
const DELIVERABLE_TYPES = [
  "dedicated_video",
  "integrated_segment",
  "reel_or_short",
  "story_sequence",
  "feed_post",
  "thread",
  "newsletter_sponsorship",
];

function inputError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeScenarioInput(input, rateCard = null) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const platform = input.platform;
  const campaignDurationDays = Number(input.campaignDurationDays);

  if (!name || name.length > 100) throw inputError("Scenario name is required and must be 100 characters or fewer");
  if (!PLATFORMS.includes(platform)) throw inputError("A supported platform is required");
  if (!Number.isInteger(campaignDurationDays) || campaignDurationDays < 1 || campaignDurationDays > 365) {
    throw inputError("Campaign duration must be between 1 and 365 days");
  }
  if (!Object.hasOwn(USAGE_RIGHTS_MULTIPLIERS, input.usageRightsOption)) {
    throw inputError("A supported usage rights option is required");
  }
  if (!Object.hasOwn(EXCLUSIVITY_MULTIPLIERS, input.exclusivityOption)) {
    throw inputError("A supported exclusivity option is required");
  }
  if (input.whitelistingAllowed !== undefined && typeof input.whitelistingAllowed !== "boolean") {
    throw inputError("Whitelisting must be a boolean");
  }

  let deliverables;
  let deliverableIds = [];
  if (rateCard) {
    deliverableIds = Array.isArray(input.deliverableIds) ? [...new Set(input.deliverableIds.map(String))] : [];
    const selected = (rateCard.deliverables || []).filter((deliverable) =>
      deliverableIds.includes(String(deliverable._id)),
    );
    if (!deliverableIds.length || selected.length !== deliverableIds.length) {
      throw inputError("Select at least one deliverable from this rate card");
    }
    if (selected.some((deliverable) => deliverable.platform !== platform)) {
      throw inputError("Selected rate-card deliverables must match the scenario platform");
    }
    deliverables = selected.map((deliverable) => ({
      rateCardDeliverableId: deliverable._id,
      deliverableType: deliverable.deliverableType,
      basePrice: Number(deliverable.basePrice),
      estimatedImpressions: Number(deliverable.estimatedImpressions) || 0,
      turnaroundDays: Number(deliverable.turnaroundDays) || 0,
      includesUsageRightsDays: Number(deliverable.includesUsageRightsDays) || 0,
      description: deliverable.description || "",
    }));
  } else {
    if (!Array.isArray(input.deliverables) || input.deliverables.length < 1 || input.deliverables.length > 20) {
      throw inputError("Add between 1 and 20 deliverables");
    }
    deliverables = input.deliverables.map((deliverable) => {
      const basePrice = Number(deliverable.basePrice);
      if (!DELIVERABLE_TYPES.includes(deliverable.deliverableType) || !Number.isFinite(basePrice) || basePrice < 0) {
        throw inputError("Each deliverable needs a supported type and a non-negative base price");
      }
      const description = typeof deliverable.description === "string" ? deliverable.description.trim() : "";
      if (description.length > 240) throw inputError("Deliverable descriptions must be 240 characters or fewer");
      return {
        deliverableType: deliverable.deliverableType,
        basePrice,
        estimatedImpressions: Number(deliverable.estimatedImpressions) || 0,
        turnaroundDays: Number(deliverable.turnaroundDays) || 0,
        includesUsageRightsDays: Number(deliverable.includesUsageRightsDays) || 0,
        description,
      };
    });
  }

  const twoDiscountPercent = Number(rateCard?.twoDeliverableBundleDiscountPercent ?? 10);
  const threePlusDiscountPercent = Number(rateCard?.threePlusBundleDiscountPercent ?? 20);
  const usageRightsOption = input.usageRightsOption;
  const exclusivityOption = input.exclusivityOption;
  const whitelistingAllowed = input.whitelistingAllowed === true;
  const quote = calculateSponsorshipQuote({
    deliverables,
    usageRightsOption,
    exclusivityOption,
    whitelistingAllowed,
    twoDiscountPercent,
    threePlusDiscountPercent,
  });
  const currency = rateCard?.currency || (typeof input.currency === "string" ? input.currency.toUpperCase() : "USD");

  return {
    name,
    inputs: {
      platform,
      campaignDurationDays,
      usageRightsOption,
      exclusivityOption,
      whitelistingAllowed,
      rateCardId: rateCard?._id || null,
      deliverableIds,
    },
    deliverables,
    quote,
    pricingRuleVersion: PRICING_RULE_VERSION,
    assumptions: {
      currency,
      rateCardTitle: rateCard?.title || null,
      twoDiscountPercent,
      threePlusDiscountPercent,
      usageRightsMultiplier: USAGE_RIGHTS_MULTIPLIERS[usageRightsOption],
      exclusivityMultiplier: EXCLUSIVITY_MULTIPLIERS[exclusivityOption],
    },
  };
}

function compareScenarios(scenarios) {
  return scenarios.map((scenario) => ({
    id: String(scenario._id),
    name: scenario.name,
    platform: scenario.inputs.platform,
    deliverables: scenario.deliverables.map((deliverable) => deliverable.description || deliverable.deliverableType),
    price: scenario.quote.finalTotal,
    currency: scenario.assumptions.currency,
    usageRightsOption: scenario.inputs.usageRightsOption,
    exclusivityOption: scenario.inputs.exclusivityOption,
    campaignDurationDays: scenario.inputs.campaignDurationDays,
    assumptions: scenario.assumptions,
    quote: scenario.quote,
    pricingRuleVersion: scenario.pricingRuleVersion,
  }));
}

function displayOption(option) {
  return String(option || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildProposal(scenario, creator = {}) {
  const currency = scenario.assumptions.currency || "USD";
  const quote = scenario.quote;
  const assumptions = [
    `Pricing rule version: ${scenario.pricingRuleVersion}`,
    `Bundle discount: ${quote.discountPercent || 0}% (${currency} ${quote.discountAmount || 0})`,
    `Usage rights surcharge: ${currency} ${quote.usageSurcharge || 0}`,
    `Exclusivity surcharge: ${currency} ${quote.exclusivitySurcharge || 0}`,
    `Whitelisting surcharge: ${currency} ${quote.whitelistingSurcharge || 0}`,
  ];

  return {
    title: `${scenario.name} Sponsorship Proposal`,
    creatorName: creator.name || "",
    creatorEmail: creator.email || "",
    brandName: "",
    campaignName: "",
    scenarioName: scenario.name,
    deliverables: scenario.deliverables.map((deliverable) => ({
      name: deliverable.description || displayOption(deliverable.deliverableType),
      basePrice: deliverable.basePrice,
    })),
    price: quote.finalTotal,
    currency,
    usageRights: displayOption(scenario.inputs.usageRightsOption),
    exclusivity: displayOption(scenario.inputs.exclusivityOption),
    campaignDurationDays: scenario.inputs.campaignDurationDays,
    assumptions,
    disclaimer: "This estimate is for planning purposes only and does not guarantee earnings. Final terms and payment are subject to agreement.",
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function renderProposalHtml(proposal) {
  const line = (value) => escapeHtml(value).replace(/\r?\n/g, "<br>");
  const deliverables = Array.isArray(proposal.deliverables) ? proposal.deliverables : [];
  const assumptions = Array.isArray(proposal.assumptions) ? proposal.assumptions : [];
  const money = `${escapeHtml(proposal.currency || "USD")} ${escapeHtml(proposal.price ?? "")}`;
  const creatorDetails = [proposal.creatorName, proposal.creatorEmail].filter(Boolean).map(line).join("<br>");
  const campaignDetails = [proposal.brandName, proposal.campaignName].filter(Boolean).map(line).join("<br>");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${line(proposal.title || "Sponsorship Proposal")}</title>
  <style>body{font:16px/1.6 system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#202722}h1,h2{line-height:1.2}h1{border-bottom:2px solid #202722;padding-bottom:16px}section{margin:28px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #c8cec9}th:last-child,td:last-child{text-align:right}.total{font-size:1.3rem;font-weight:700}.muted{color:#59635c;font-size:.9rem}</style>
</head>
<body>
  <h1>${line(proposal.title || "Sponsorship Proposal")}</h1>
  <section><h2>Creator</h2><p>${creatorDetails || "Not provided"}</p></section>
  ${campaignDetails ? `<section><h2>Brand and campaign</h2><p>${campaignDetails}</p></section>` : ""}
  <section><h2>Deliverables</h2><table><thead><tr><th>Deliverable</th><th>Base price</th></tr></thead><tbody>${deliverables.map((deliverable) => `<tr><td>${line(deliverable.name)}</td><td>${escapeHtml(proposal.currency || "USD")} ${escapeHtml(deliverable.basePrice ?? "")}</td></tr>`).join("")}</tbody></table></section>
  <section><h2>Pricing</h2><p class="total">${money}</p><p>Usage rights: ${line(proposal.usageRights)}<br>Exclusivity: ${line(proposal.exclusivity)}<br>Campaign duration: ${line(proposal.campaignDurationDays)} days</p></section>
  <section><h2>Pricing assumptions</h2><ul>${assumptions.map((assumption) => `<li>${line(assumption)}</li>`).join("")}</ul></section>
  <p class="muted">${line(proposal.disclaimer || "This estimate is not guaranteed earnings.")}</p>
</body>
</html>`;
}

module.exports = {
  PLATFORMS,
  DELIVERABLE_TYPES,
  normalizeScenarioInput,
  compareScenarios,
  buildProposal,
  escapeHtml,
  renderProposalHtml,
};