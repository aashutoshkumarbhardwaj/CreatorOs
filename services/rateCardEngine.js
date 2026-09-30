/**
 * Sponsorship Rate Card Pricing Engine
 * Computes benchmark CPMs, engagement bonuses, usage rights surcharges, exclusivity, and bundle discounts
 */

const NICHE_BENCHMARK_CPM = {
  finance: 45.0,
  tech: 35.0,
  business: 32.0,
  education: 28.0,
  fitness: 24.0,
  beauty: 22.0,
  lifestyle: 20.0,
  gaming: 18.0,
  other: 20.0,
};

const USAGE_RIGHTS_MULTIPLIERS = {
  organic_only: 0.0,
  days_30: 0.25, // +25%
  days_90: 0.5, // +50%
  days_180: 0.8, // +80%
  days_365: 1.2, // +120%
  in_perpetuity: 2.0, // +200%
};

const EXCLUSIVITY_MULTIPLIERS = {
  none: 0.0,
  days_30: 0.3, // +30%
  days_90: 0.6, // +60%
  days_180: 1.0, // +100%
};

/**
 * Calculate recommended baseline rate from impressions and engagement
 */
function calculateBaselineRate({ niche = "tech", estimatedViews = 10000, engagementRatePercent = 4.0 }) {
  const cpm = NICHE_BENCHMARK_CPM[niche.toLowerCase()] || 20.0;
  const baseFromViews = (estimatedViews / 1000) * cpm;

  // Engagement tier multiplier
  let engagementMultiplier = 1.0;
  if (engagementRatePercent >= 10.0) {
    engagementMultiplier = 1.5;
  } else if (engagementRatePercent >= 6.0) {
    engagementMultiplier = 1.25;
  } else if (engagementRatePercent >= 4.0) {
    engagementMultiplier = 1.0;
  } else {
    engagementMultiplier = 0.85;
  }

  return Number((baseFromViews * engagementMultiplier).toFixed(2));
}

/**
 * Validates inputs for sponsorship quote calculation
 */
function validateSponsorshipQuoteInputs({
  deliverables,
  usageRightsOption,
  exclusivityOption,
  twoDiscountPercent,
  threePlusDiscountPercent,
}) {
  if (deliverables === undefined || deliverables === null) {
    throw new TypeError("deliverables is required and must be an array");
  }

  if (!Array.isArray(deliverables)) {
    throw new TypeError("deliverables must be an array");
  }

  for (let i = 0; i < deliverables.length; i++) {
    const d = deliverables[i];
    if (!d || typeof d !== "object" || Array.isArray(d)) {
      throw new TypeError(`deliverable at index ${i} must be a valid object`);
    }

    if (
      d.basePrice === undefined ||
      d.basePrice === null ||
      d.basePrice === "" ||
      (typeof d.basePrice === "string" && d.basePrice.trim() === "") ||
      typeof d.basePrice === "boolean"
    ) {
      throw new TypeError(`deliverable at index ${i} requires a valid basePrice`);
    }

    const price = Number(d.basePrice);
    if (!Number.isFinite(price) || isNaN(price)) {
      throw new TypeError(`deliverable at index ${i} basePrice must be a finite number`);
    }

    if (price < 0) {
      throw new RangeError(`deliverable at index ${i} basePrice must be non-negative`);
    }
  }

  if (twoDiscountPercent !== undefined && twoDiscountPercent !== null) {
    if (
      typeof twoDiscountPercent === "boolean" ||
      twoDiscountPercent === "" ||
      (typeof twoDiscountPercent === "string" && twoDiscountPercent.trim() === "")
    ) {
      throw new TypeError("twoDiscountPercent must be a finite number between 0 and 100");
    }
    const val = Number(twoDiscountPercent);
    if (!Number.isFinite(val) || isNaN(val)) {
      throw new TypeError("twoDiscountPercent must be a finite number between 0 and 100");
    }
    if (val < 0 || val > 100) {
      throw new RangeError("twoDiscountPercent must be between 0 and 100");
    }
  }

  if (threePlusDiscountPercent !== undefined && threePlusDiscountPercent !== null) {
    if (
      typeof threePlusDiscountPercent === "boolean" ||
      threePlusDiscountPercent === "" ||
      (typeof threePlusDiscountPercent === "string" && threePlusDiscountPercent.trim() === "")
    ) {
      throw new TypeError("threePlusDiscountPercent must be a finite number between 0 and 100");
    }
    const val = Number(threePlusDiscountPercent);
    if (!Number.isFinite(val) || isNaN(val)) {
      throw new TypeError("threePlusDiscountPercent must be a finite number between 0 and 100");
    }
    if (val < 0 || val > 100) {
      throw new RangeError("threePlusDiscountPercent must be between 0 and 100");
    }
  }

  if (
    usageRightsOption !== undefined &&
    usageRightsOption !== null &&
    !(usageRightsOption in USAGE_RIGHTS_MULTIPLIERS)
  ) {
    throw new RangeError(`Invalid usageRightsOption: ${usageRightsOption}`);
  }

  if (
    exclusivityOption !== undefined &&
    exclusivityOption !== null &&
    !(exclusivityOption in EXCLUSIVITY_MULTIPLIERS)
  ) {
    throw new RangeError(`Invalid exclusivityOption: ${exclusivityOption}`);
  }
}

/**
 * Calculate full quotation with add-ons and bundle discounts
 */
function calculateSponsorshipQuote({
  deliverables = [],
  usageRightsOption = "organic_only",
  exclusivityOption = "none",
  whitelistingAllowed = false,
  twoDiscountPercent = 10,
  threePlusDiscountPercent = 20,
} = {}) {
  validateSponsorshipQuoteInputs({
    deliverables,
    usageRightsOption,
    exclusivityOption,
    twoDiscountPercent,
    threePlusDiscountPercent,
  });

  if (deliverables.length === 0) {
    return {
      subtotal: 0,
      usageRightsOption,
      usageSurcharge: 0,
      exclusivityOption,
      exclusivitySurcharge: 0,
      whitelistingAllowed: Boolean(whitelistingAllowed),
      whitelistingSurcharge: 0,
      grossTotal: 0,
      discountPercent: 0,
      discountAmount: 0,
      finalTotal: 0,
      deliverablesCount: 0,
    };
  }

  const baseDeliverablesSum = Number(
    deliverables.reduce((sum, d) => sum + Number(d.basePrice), 0).toFixed(2)
  );

  const usageFactor = USAGE_RIGHTS_MULTIPLIERS[usageRightsOption] || 0;
  const usageSurcharge = Number((baseDeliverablesSum * usageFactor).toFixed(2));

  const exclusivityFactor = EXCLUSIVITY_MULTIPLIERS[exclusivityOption] || 0;
  const exclusivitySurcharge = Number((baseDeliverablesSum * exclusivityFactor).toFixed(2));

  const whitelistingSurcharge = whitelistingAllowed
    ? Number((baseDeliverablesSum * 0.35).toFixed(2))
    : 0;

  const grossTotal = Number(
    (baseDeliverablesSum + usageSurcharge + exclusivitySurcharge + whitelistingSurcharge).toFixed(2)
  );

  let discountPercent = 0;
  if (deliverables.length >= 3) {
    discountPercent = Number(threePlusDiscountPercent);
  } else if (deliverables.length === 2) {
    discountPercent = Number(twoDiscountPercent);
  }

  const discountAmount = Number(((grossTotal * discountPercent) / 100).toFixed(2));
  const finalTotal = Math.max(0, Number((grossTotal - discountAmount).toFixed(2)));

  return {
    subtotal: baseDeliverablesSum,
    usageRightsOption,
    usageSurcharge,
    exclusivityOption,
    exclusivitySurcharge,
    whitelistingAllowed: Boolean(whitelistingAllowed),
    whitelistingSurcharge,
    grossTotal,
    discountPercent,
    discountAmount,
    finalTotal,
    deliverablesCount: deliverables.length,
  };
}

module.exports = {
  NICHE_BENCHMARK_CPM,
  USAGE_RIGHTS_MULTIPLIERS,
  EXCLUSIVITY_MULTIPLIERS,
  calculateBaselineRate,
  validateSponsorshipQuoteInputs,
  calculateSponsorshipQuote,
};
