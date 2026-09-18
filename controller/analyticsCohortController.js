const AnalyticsCohort = require("../model/analyticsCohort");
const { computeHealthScore, detectMetricAnomaly, calculateCohortDecay } = require("../services/analyticsAggregationEngine");

/**
 * Record or update monthly cohort snapshot
 */
exports.recordCohortSnapshot = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { cohortMonth, newFollowersAcquired, retentionCounts, platformMetrics, priorPeriodViews } = req.body;

    if (!cohortMonth) {
      return res.status(400).json({ success: false, message: "cohortMonth (YYYY-MM) is required" });
    }

    const followers = Number(newFollowersAcquired) || 0;
    const decay = retentionCounts
      ? calculateCohortDecay(
          followers,
          retentionCounts.activeDay7 || 0,
          retentionCounts.activeDay14 || 0,
          retentionCounts.activeDay30 || 0,
          retentionCounts.activeDay60 || 0
        )
      : { day7: 0, day14: 0, day30: 0, day60: 0 };

    const totalViews = (platformMetrics?.youtubeViews || 0) + (platformMetrics?.tiktokViews || 0);
    const healthScore = computeHealthScore({
      totalViews,
      engagementRatePercent: platformMetrics?.instagramEngagementRate || 0,
      grossRevenue: platformMetrics?.storeGrossRevenue || 0,
      bioClicks: platformMetrics?.smartBioClicks || 0,
    });

    const anomalyCheck = priorPeriodViews
      ? detectMetricAnomaly(totalViews, priorPeriodViews, "Cross-Platform Views")
      : { isAnomaly: false };

    let cohort = await AnalyticsCohort.findOne({ creatorId, cohortMonth });
    if (cohort) {
      cohort.newFollowersAcquired = followers;
      cohort.retention = {
        day7Retention: decay.day7,
        day14Retention: decay.day14,
        day30Retention: decay.day30,
        day60Retention: decay.day60,
      };
      cohort.metrics = platformMetrics || cohort.metrics;
      cohort.compositeHealthScore = healthScore;
      cohort.anomalyFlag = anomalyCheck.isAnomaly;
      cohort.anomalyNote = anomalyCheck.reason || "";
      await cohort.save();
    } else {
      cohort = new AnalyticsCohort({
        creatorId,
        cohortMonth,
        newFollowersAcquired: followers,
        retention: {
          day7Retention: decay.day7,
          day14Retention: decay.day14,
          day30Retention: decay.day30,
          day60Retention: decay.day60,
        },
        metrics: platformMetrics || {},
        compositeHealthScore: healthScore,
        anomalyFlag: anomalyCheck.isAnomaly,
        anomalyNote: anomalyCheck.reason || "",
      });
      await cohort.save();
    }

    return res.status(201).json({
      success: true,
      message: "Cohort snapshot recorded successfully",
      cohort,
    });
  } catch (error) {
    console.error("Cohort snapshot error:", error);
    return res.status(500).json({ success: false, message: "Failed to record snapshot", error: error.message });
  }
};

/**
 * Get all cohorts for creator
 */
exports.getCohorts = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const cohorts = await AnalyticsCohort.find({ creatorId }).sort({ cohortMonth: -1 });

    return res.status(200).json({
      success: true,
      count: cohorts.length,
      cohorts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch cohorts", error: error.message });
  }
};

/**
 * Diagnostic anomaly audit endpoint
 */
exports.auditAnomalies = async (req, res) => {
  try {
    const { currentMetric, priorBaseline, metricName } = req.body;
    const audit = detectMetricAnomaly(Number(currentMetric), Number(priorBaseline), metricName);

    return res.status(200).json({ success: true, audit });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Audit failed", error: error.message });
  }
};
