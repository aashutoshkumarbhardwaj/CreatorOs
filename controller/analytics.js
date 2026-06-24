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

    let fetchedData = {
        followers: 0,
        following: 0,
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        totalViews: 0,
        engagementRate: 0,
    };

    if (creator.platform === 'instagram') {
        try {
            const { fetchInstagramProfile } = require('../utils/instagramProfileService');
            const profile = await fetchInstagramProfile(creator.username);
            fetchedData.followers = profile.followers || 0;
            fetchedData.following = profile.following || 0;
            fetchedData.totalPosts = profile.totalPosts || 0;
        } catch (err) {
            console.error(`[Analytics] Failed to fetch profile for ${creator.username}:`, err.message);
        }
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