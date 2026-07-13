const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");
const asyncHandler = require("../utils/asyncHandler");
const { fetchInstagramAnalytics } = require("../utils/instagramApi");

// GET /api/analytics/:creatorId/snapshots
const getSnapshots = asyncHandler(async (req, res) => {
    const snapshots = await AnalyticsSnapshot.find({
        creatorId: req.params.creatorId,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: snapshots });
});

// GET /api/analytics/:creatorId/snapshots/latest
const getLatestSnapshot = asyncHandler(async (req, res) => {
    const snapshot = await AnalyticsSnapshot.findOne(
        { creatorId: req.params.creatorId },
        {},
        { sort: { createdAt: -1 } }
    );

    if (!snapshot) {
        return res.status(404).json({ success: false, message: "No snapshot found" });
    }

    res.json({ success: true, data: snapshot });
});

// GET /api/analytics/:creatorId/engagement-history
const getEngagementHistory = asyncHandler(async (req, res) => {
    const history = await EngagementHistory.find({
        creatorId: req.params.creatorId,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: history });
});

// POST /api/analytics/:creatorId/refresh
const triggerRefresh = asyncHandler(async (req, res) => {
    const creator = await Creator.findById(req.params.creatorId);
    if (!creator) {
        return res.status(404).json({ success: false, message: "Creator not found" });
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

const getHeatmapData = asyncHandler(async (req, res) => {
    const Url = require("../model/url");
    const link = await Url.findById(req.params.linkId).lean();
    if (!link) {
        return res.status(404).json({ success: false, message: "Link not found" });
    }

    // Ensure the user owns this link (or is a collaborator)
    // For simplicity:
    if (link.userId.toString() !== req.user.id) {
        return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const heatmapData = link.visitHistory
        .filter(visit => visit.x !== undefined && visit.y !== undefined)
        .map(visit => ({ x: visit.x, y: visit.y }));

    res.json({ success: true, data: heatmapData });
});

module.exports = {
    getSnapshots,
    getLatestSnapshot,
    triggerRefresh,
    getEngagementHistory,
    getHeatmapData
};