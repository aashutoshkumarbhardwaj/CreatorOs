/**
 * Analytics Aggregation & Cohort Engine
 * Computes cross-platform composite health scores and detects traffic anomalies
 */

/**
 * Compute composite Creator Health Score (0 - 100)
 * Weights:
 * - Reach / Views (30%)
 * - Engagement Rate (35%)
 * - Monetization Velocity (20%)
 * - Smart Bio Conversion (15%)
 */
function computeHealthScore({ totalViews = 0, engagementRatePercent = 0, grossRevenue = 0, bioClicks = 0 }) {
  // Normalize views (target 50,000 monthly views for 100 pts)
  const viewsScore = Math.min(100, (totalViews / 50000) * 100);

  // Normalize engagement (target 8% engagement for 100 pts)
  const engagementScore = Math.min(100, (engagementRatePercent / 8.0) * 100);

  // Normalize revenue (target $2,000 for 100 pts)
  const revenueScore = Math.min(100, (grossRevenue / 2000) * 100);

  // Normalize bio clicks (target 1,000 clicks for 100 pts)
  const bioScore = Math.min(100, (bioClicks / 1000) * 100);

  const composite = viewsScore * 0.3 + engagementScore * 0.35 + revenueScore * 0.2 + bioScore * 0.15;

  return Number(composite.toFixed(1));
}

/**
 * Anomaly detection against rolling baseline
 * Triggers anomaly flag if current 7-day metric drops > 35% compared to prior period
 */
function detectMetricAnomaly(currentPeriodValue, priorBaselineValue, metricName = "Traffic") {
  if (priorBaselineValue <= 0) {
    return { isAnomaly: false, dropPercent: 0, reason: "Insufficient baseline data" };
  }

  const dropPercent = Number((((priorBaselineValue - currentPeriodValue) / priorBaselineValue) * 100).toFixed(1));

  if (dropPercent >= 35.0) {
    return {
      isAnomaly: true,
      dropPercent,
      severity: dropPercent >= 60 ? "critical" : "warning",
      reason: `${metricName} experienced an unexpected drop of ${dropPercent}% compared to rolling baseline.`,
    };
  }

  return { isAnomaly: false, dropPercent: Math.max(0, dropPercent), reason: "Within standard variance" };
}

/**
 * Calculate cohort retention decay curve
 */
function calculateCohortDecay(initialCohortSize, activeDay7, activeDay14, activeDay30, activeDay60) {
  if (!initialCohortSize || initialCohortSize <= 0) {
    return { day7: 0, day14: 0, day30: 0, day60: 0 };
  }

  return {
    day7: Number(((activeDay7 / initialCohortSize) * 100).toFixed(1)),
    day14: Number(((activeDay14 / initialCohortSize) * 100).toFixed(1)),
    day30: Number(((activeDay30 / initialCohortSize) * 100).toFixed(1)),
    day60: Number(((activeDay60 / initialCohortSize) * 100).toFixed(1)),
  };
}

module.exports = {
  computeHealthScore,
  detectMetricAnomaly,
  calculateCohortDecay,
};
