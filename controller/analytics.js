const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");
const asyncHandler = require("../utils/asyncHandler");
const { fetchInstagramAnalytics } = require("../utils/instagramApi");

const verifyCreatorOwnership = async (creatorId, userId) => {
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
    }).sort({ createdAt: -1 });

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
    );

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
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: history });
});

// POST /api/analytics/:creatorId/refresh
const triggerRefresh = asyncHandler(async (req, res) => {
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

module.exports = { getSnapshots, getLatestSnapshot, triggerRefresh, getEngagementHistory };