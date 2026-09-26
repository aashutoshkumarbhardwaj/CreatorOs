/**
 * CRM Deal Forecasting & Deliverable Analytics Service
 */

/**
 * Calculate expected weighted pipeline value
 */
function computeWeightedForecast(deals = []) {
  if (!deals || deals.length === 0) {
    return {
      totalPipelineGross: 0,
      totalWeightedForecast: 0,
      activeDealsCount: 0,
      stageBreakdown: {},
    };
  }

  let totalGross = 0;
  let weightedSum = 0;
  const stageBreakdown = {};

  deals.forEach((deal) => {
    const val = Number(deal.totalContractValue) || 0;
    const prob = Number(deal.stageProbabilityPercent) || 0;
    const stage = deal.stage || "negotiation";

    totalGross += val;
    const weighted = Number(((val * prob) / 100).toFixed(2));
    weightedSum += weighted;

    if (!stageBreakdown[stage]) {
      stageBreakdown[stage] = { count: 0, grossValue: 0, weightedValue: 0 };
    }
    stageBreakdown[stage].count += 1;
    stageBreakdown[stage].grossValue = Number((stageBreakdown[stage].grossValue + val).toFixed(2));
    stageBreakdown[stage].weightedValue = Number((stageBreakdown[stage].weightedValue + weighted).toFixed(2));
  });

  return {
    totalPipelineGross: Number(totalGross.toFixed(2)),
    totalWeightedForecast: Number(weightedSum.toFixed(2)),
    activeDealsCount: deals.length,
    stageBreakdown,
  };
}

/**
 * Identify stalled deals (no activity for >= thresholdDays)
 */
function findStalledDeals(deals = [], thresholdDays = 14) {
  const cutoffTime = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

  return deals
    .filter((d) => {
      if (d.stage === "paid" || d.stage === "lost") return false;
      const lastActive = d.lastActivityAt ? new Date(d.lastActivityAt).getTime() : 0;
      return lastActive < cutoffTime;
    })
    .map((d) => {
      const daysInactive = Math.floor((Date.now() - new Date(d.lastActivityAt || d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: d._id,
        brandName: d.brandName,
        stage: d.stage,
        totalContractValue: d.totalContractValue,
        daysInactive,
      };
    });
}

/**
 * Calculate deliverable fulfillment completion percentage
 */
function calculateDeliverableFulfillment(deliverables = []) {
  if (!deliverables || deliverables.length === 0) return { total: 0, completed: 0, percent: 100 };

  const completed = deliverables.filter((d) => d.status === "approved_by_brand" || d.status === "published").length;
  const percent = Number(((completed / deliverables.length) * 100).toFixed(1));

  return {
    total: deliverables.length,
    completed,
    percent,
  };
}

module.exports = {
  computeWeightedForecast,
  findStalledDeals,
  calculateDeliverableFulfillment,
};
