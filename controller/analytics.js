const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");
const asyncHandler = require("../utils/asyncHandler");

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

    // TODO: Replace with real API fetch
    const mockData = {
        followers: Math.floor(Math.random() * 10000),
        following: Math.floor(Math.random() * 1000),
        totalPosts: Math.floor(Math.random() * 500),
        totalLikes: Math.floor(Math.random() * 50000),
        totalComments: Math.floor(Math.random() * 5000),
        totalViews: Math.floor(Math.random() * 100000),
        engagementRate: parseFloat((Math.random() * 10).toFixed(2)),
    };

    const snapshot = await AnalyticsSnapshot.create({
        creatorId: creator._id,
        platform: creator.platform,
        ...mockData,
        snapshotDate: new Date(),
    });

    await Creator.findByIdAndUpdate(creator._id, {
        lastRefreshedAt: new Date(),
    });

    res.json({ success: true, message: "Refresh successful", data: snapshot });
});

module.exports = { getSnapshots, getLatestSnapshot, triggerRefresh, getEngagementHistory };