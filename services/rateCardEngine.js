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
 * Calculate full quotation with add-ons and bundle discounts
 */
function calculateSponsorshipQuote({
  deliverables = [],
  usageRightsOption = "organic_only",
  exclusivityOption = "none",
  whitelistingAllowed = false,
  twoDiscountPercent = 10,
  threePlusDiscountPercent = 20,
}) {
  if (!deliverables || deliverables.length === 0) {
    return {
      subtotal: 0,
      usageSurcharge: 0,
      exclusivitySurcharge: 0,
      whitelistingSurcharge: 0,
      discountAmount: 0,
      finalTotal: 0,
      deliverablesCount: 0,
    };
  }

  const baseDeliverablesSum = deliverables.reduce((sum, d) => sum + (Number(d.basePrice) || 0), 0);

  const usageFactor = USAGE_RIGHTS_MULTIPLIERS[usageRightsOption] || 0;
  const usageSurcharge = Number((baseDeliverablesSum * usageFactor).toFixed(2));

  const exclusivityFactor = EXCLUSIVITY_MULTIPLIERS[exclusivityOption] || 0;
  const exclusivitySurcharge = Number((baseDeliverablesSum * exclusivityFactor).toFixed(2));

  const whitelistingSurcharge = whitelistingAllowed ? Number((baseDeliverablesSum * 0.35).toFixed(2)) : 0;

  const grossTotal = Number(
    (baseDeliverablesSum + usageSurcharge + exclusivitySurcharge + whitelistingSurcharge).toFixed(2)
  );

  let discountPercent = 0;
  if (deliverables.length >= 3) {
    discountPercent = threePlusDiscountPercent;
  } else if (deliverables.length === 2) {
    discountPercent = twoDiscountPercent;
  }

  const discountAmount = Number(((grossTotal * discountPercent) / 100).toFixed(2));
  const finalTotal = Number((grossTotal - discountAmount).toFixed(2));

  return {
    subtotal: baseDeliverablesSum,
    usageRightsOption,
    usageSurcharge,
    exclusivityOption,
    exclusivitySurcharge,
    whitelistingAllowed,
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
  calculateSponsorshipQuote,
};
