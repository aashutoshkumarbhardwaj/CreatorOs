const mongoose = require("mongoose");
const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");
const asyncHandler = require("../utils/asyncHandler");
const { fetchInstagramAnalytics } = require("../utils/instagramApi");

const verifyCreatorOwnership = async (creatorId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(creatorId)) return false;
    const creator = await Creator.findById(creatorId);
    if (!creator) return false;
    return creator.userId.toString() === userId.toString();
};

// GET /api/analytics/:creatorId/snapshots
const getSnapshots = asyncHandler(async (req, res) => {
    const isOwner = await verifyCreatorOwnership(req.params.creatorId, req.user.id);
    if (!isOwner) {
        return res.status(403).json({ success: false, message: "Unauthorized access to creator analytics" });
    }

    const snapshots = await AnalyticsSnapshot.find({
        creatorId: req.params.creatorId,
    }).select('creatorId platform followers following totalPosts totalLikes totalComments totalViews engagementRate engagementAvailable snapshotDate createdAt updatedAt').sort({ createdAt: -1 });

    res.json({ success: true, data: snapshots });
});

// GET /api/analytics/:creatorId/snapshots/latest
const getLatestSnapshot = asyncHandler(async (req, res) => {
    const isOwner = await verifyCreatorOwnership(req.params.creatorId, req.user.id);
    if (!isOwner) {
        return res.status(403).json({ success: false, message: "Unauthorized access to creator analytics" });
    }

    const snapshot = await AnalyticsSnapshot.findOne(
        { creatorId: req.params.creatorId },
        {},
        { sort: { createdAt: -1 } }
    ).select('creatorId platform followers following totalPosts totalLikes totalComments totalViews engagementRate engagementAvailable snapshotDate createdAt updatedAt');

    if (!snapshot) {
        return res.status(404).json({ success: false, message: "No snapshot found" });
    }

    res.json({ success: true, data: snapshot });
});

// GET /api/analytics/:creatorId/engagement-history
const getEngagementHistory = asyncHandler(async (req, res) => {
    const isOwner = await verifyCreatorOwnership(req.params.creatorId, req.user.id);
    if (!isOwner) {
        return res.status(403).json({ success: false, message: "Unauthorized access to creator analytics" });
    }

    const history = await EngagementHistory.find({
        creatorId: req.params.creatorId,
    }).select('creatorId engagementMetric value timestamp createdAt updatedAt').sort({ createdAt: -1 });

    res.json({ success: true, data: history });
});

// POST /api/analytics/:creatorId/refresh
const triggerRefresh = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.creatorId)) {
        return res.status(400).json({ success: false, message: "Invalid creatorId" });
    }

    const creator = await Creator.findById(req.params.creatorId);
    if (!creator) {
        return res.status(404).json({ success: false, message: "Creator not found" });
    }

    if (creator.userId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: "Unauthorized access to creator analytics" });
    }

    let fetchedData;
    try {
        fetchedData = await fetchInstagramAnalytics(creator);
    } catch (error) {
        return res.status(502).json({ success: false, message: "Failed to fetch data from external API", error: error.message });
    }

    const snapshot = await AnalyticsSnapshot.create({
        creatorId: creator._id,
        platform: creator.platform,
        ...fetchedData,
        snapshotDate: new Date(),
    });

    await Creator.findByIdAndUpdate(creator._id, {
        lastRefreshedAt: new Date(),
    });

    res.json({ success: true, message: "Refresh successful", data: snapshot });
});

const { buildUnifiedAnalyticsData } = require("../utils/analyticsHelper");

// GET /api/analytics/summary
const getAnalyticsSummary = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.id : "mock_user_id";
    const data = await buildUnifiedAnalyticsData(userId, {
        range: req.query.range || "30",
        creatorId: req.query.creatorId || null,
        shortLinkId: req.query.link || null,
    });
    res.json({ success: true, data });
});

// GET /api/analytics/live-count
const getLiveCount = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.id : "mock_user_id";
    const data = await buildUnifiedAnalyticsData(userId, { range: "30" });
    res.json({
        success: true,
        totalClicks: data.summaryCards.clicks.value,
        totalViews: data.summaryCards.views.value,
        totalDownloads: data.summaryCards.downloads.value,
        totalRevenue: data.summaryCards.revenue.value,
        activeTriggers: data.moduleMetrics.dmAutomation.activeTriggers,
        timestamp: new Date(),
    });
});

// GET /api/analytics/export
const exportAnalyticsCsv = asyncHandler(async (req, res) => {
    const userId = req.user ? req.user.id : "mock_user_id";
    const range = req.query.range || "30";
    const data = await buildUnifiedAnalyticsData(userId, { range });

    const lines = [];
    lines.push("CreatorOS Unified Analytics Report");
    lines.push(`Generated At,${new Date().toISOString()}`);
    lines.push(`Date Range,Last ${range} Days`);
    lines.push("");

    lines.push("--- OVERVIEW METRICS ---");
    lines.push("Metric,Value,Growth Rate (%)");
    lines.push(`Total Traffic,${data.summaryCards.traffic.value},${data.summaryCards.traffic.growth}%`);
    lines.push(`Total Clicks,${data.summaryCards.clicks.value},${data.summaryCards.clicks.growth}%`);
    lines.push(`Total Views,${data.summaryCards.views.value},${data.summaryCards.views.growth}%`);
    lines.push(`Vault Downloads,${data.summaryCards.downloads.value},${data.summaryCards.downloads.growth}%`);
    lines.push(`Total Followers,${data.summaryCards.followers.value},${data.summaryCards.followers.growth}%`);
    lines.push(`CRM Conversions,${data.summaryCards.conversions.value},${data.summaryCards.conversions.growth}%`);
    lines.push(`Total Revenue ($),${data.summaryCards.revenue.value},${data.summaryCards.revenue.growth}%`);
    lines.push(`Avg Engagement Rate (%),${data.summaryCards.engagementRate.value}%,${data.summaryCards.engagementRate.growth}%`);
    lines.push("");

    lines.push("--- MODULE BREAKDOWN ---");
    lines.push("Module,Primary Metric,Secondary Metric");
    lines.push(`Smart Bio,${data.moduleMetrics.smartBio.views} views,${data.moduleMetrics.smartBio.clicks} clicks`);
    lines.push(`URL Shortener,${data.moduleMetrics.urlShortener.totalLinks} links,${data.moduleMetrics.urlShortener.totalClicks} clicks`);
    lines.push(`File Upload,${data.moduleMetrics.fileUpload.totalFiles} files (${data.moduleMetrics.fileUpload.storageMB} MB),${data.moduleMetrics.fileUpload.downloads} downloads`);
    lines.push(`Creator CRM,${data.moduleMetrics.creatorCrm.deals} deals (${data.moduleMetrics.creatorCrm.closedWon} won),${data.moduleMetrics.creatorCrm.conversionRate}% conv rate`);
    lines.push(`DM Automation,${data.moduleMetrics.dmAutomation.activeTriggers} active triggers,${data.moduleMetrics.dmAutomation.executions} DMs sent`);
    lines.push(`Content OS,${data.moduleMetrics.contentOs.published} published posts,${data.moduleMetrics.contentOs.engagementRate}% avg engagement`);
    lines.push("");

    lines.push("--- TOP PERFORMING CONTENT ---");
    lines.push("Title,Source Module,Metric Summary,Date");
    (data.topContent || []).forEach(item => {
        lines.push(`"${item.title.replace(/"/g, '""')}",${item.source},"${item.metrics}",${item.date}`);
    });

    const csvContent = lines.join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="creatoros_analytics_${range}d_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
});

// GET /api/analytics/creators
const getCreatorsByUser = asyncHandler(async (req, res) => {
    const creators = await Creator.find({ userId: req.user ? req.user.id : "mock_user_id" })
        .select('_id username platform profileUrl avatar')
        .lean();

    res.json({ success: true, data: creators });
});

module.exports = {
    getSnapshots,
    getLatestSnapshot,
    triggerRefresh,
    getEngagementHistory,
    getCreatorsByUser,
    getAnalyticsSummary,
    getLiveCount,
    exportAnalyticsCsv,
};
