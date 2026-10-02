const {
  PRICING_RULE_VERSION,
} = require("../../services/rateCardEngine");
const {
  normalizeScenarioInput,
  compareScenarios,
  buildProposal,
  renderProposalHtml,
} = require("../../services/sponsorshipScenarioService");

function createScenario(overrides = {}) {
  return normalizeScenarioInput({
    name: "Organic launch",
    platform: "instagram",
    campaignDurationDays: 30,
    usageRightsOption: "days_90",
    exclusivityOption: "days_30",
    deliverables: [
      { deliverableType: "reel_or_short", basePrice: 500, description: "Launch reel" },
    ],
    ...overrides,
  });
}

describe("sponsorship scenario service", () => {
  it("creates a scenario and calculates its price with the shared rate-card engine", () => {
    const scenario = createScenario();

    expect(scenario.quote.finalTotal).toBe(900);
    expect(scenario.quote.subtotal).toBe(500);
    expect(scenario.pricingRuleVersion).toBe(PRICING_RULE_VERSION);
  });

  it("validates required scenario inputs and deliverables", () => {
    expect(() => createScenario({ platform: "invalid" })).toThrow("A supported platform is required");
    expect(() => createScenario({ campaignDurationDays: 0 })).toThrow("Campaign duration must be between 1 and 365 days");
    expect(() => createScenario({ deliverables: [] })).toThrow("Add between 1 and 20 deliverables");
  });

  it("compares multiple scenarios without ranking them", () => {
    const first = { _id: "first", ...createScenario() };
    const second = {
      _id: "second",
      ...createScenario({ name: "Organic and paid", usageRightsOption: "days_180", campaignDurationDays: 90 }),
    };

    const compared = compareScenarios([first, second]);
    expect(compared).toHaveLength(2);
    expect(compared.map((item) => item.name)).toEqual(["Organic launch", "Organic and paid"]);
    expect(compared[0]).toMatchObject({ price: 900, usageRightsOption: "days_90", campaignDurationDays: 30 });
    expect(compared[1]).toMatchObject({ price: 1050, usageRightsOption: "days_180", campaignDurationDays: 90 });
    expect(compared.some((item) => "rank" in item || "recommendation" in item)).toBe(false);
  });

  it("generates proposal creator, campaign, pricing, and assumption fields", () => {
    const scenario = { name: "Organic launch", ...createScenario() };
    const proposal = buildProposal(scenario, { name: "Avery Creator", email: "avery@example.com" });

    expect(proposal).toMatchObject({
      creatorName: "Avery Creator",
      creatorEmail: "avery@example.com",
      price: 900,
      usageRights: "Days 90",
      exclusivity: "Days 30",
      campaignDurationDays: 30,
    });
    expect(proposal.assumptions).toContain(`Pricing rule version: ${PRICING_RULE_VERSION}`);
    expect(proposal.disclaimer).toMatch(/does not guarantee earnings/);
  });

  it("keeps proposal fields editable before rendering the export", () => {
    const proposal = buildProposal({ name: "Organic launch", ...createScenario() });
    proposal.title = "Updated launch proposal";
    proposal.brandName = "Northstar";
    proposal.price = "1250";
    proposal.deliverables[0].name = "Updated product reel";

    const html = renderProposalHtml(proposal);
    expect(html).toContain("Updated launch proposal");
    expect(html).toContain("Northstar");
    expect(html).toContain("USD 1250");
    expect(html).toContain("Updated product reel");
  });

  it("escapes user-entered HTML throughout the standalone proposal", () => {
    const html = renderProposalHtml({
      title: "<script>alert(1)</script>",
      creatorName: "<img src=x onerror=alert(1)>",
      brandName: "<b>Brand</b>",
      campaignName: "<svg/onload=alert(1)>",
      deliverables: [{ name: "<iframe src=x>", basePrice: "1<script>" }],
      price: "<script>2</script>",
      currency: "<b>USD</b>",
      usageRights: "<script>rights</script>",
      exclusivity: "<script>exclusive</script>",
      campaignDurationDays: "<script>7</script>",
      assumptions: ["<script>assumption</script>"],
      disclaimer: "<script>disclaimer</script>",
    });

    expect(html).not.toMatch(/<script|<img|<iframe|<svg|<b>/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("preserves assumptions and saved inputs for reproducibility", () => {
    const original = createScenario({
      usageRightsOption: "days_365",
      exclusivityOption: "days_90",
      whitelistingAllowed: true,
    });
    const saved = JSON.parse(JSON.stringify(original));
    const repeated = normalizeScenarioInput({
      name: saved.name,
      ...saved.inputs,
      deliverables: saved.deliverables,
      currency: saved.assumptions.currency,
    });

    expect(saved.pricingRuleVersion).toBe(PRICING_RULE_VERSION);
    expect(repeated.quote).toEqual(saved.quote);
    expect(repeated.assumptions).toEqual(saved.assumptions);
  });
});