const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");
const Post = require("../model/post");
const asyncHandler = require("../utils/asyncHandler");
const { fetchInstagramAnalytics } = require("../utils/instagramApi");
const PDFDocument = require("pdfkit");

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

// GET /api/analytics/:creatorId/export?format=csv|pdf
const exportAnalytics = asyncHandler(async (req, res) => {
    const isOwner = await verifyCreatorOwnership(req.params.creatorId, req.user.id);
    if (!isOwner) {
        return res.status(403).json({ success: false, message: "Unauthorized access to creator analytics" });
    }

    const format = (req.query.format || 'csv').toLowerCase();
    const creator = await Creator.findById(req.params.creatorId).lean();
    if (!creator) {
        return res.status(404).json({ success: false, message: "Creator not found" });
    }

    const { startDate, endDate } = req.query;
    const dateFilter = { creatorId: req.params.creatorId };
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const [snapshots, engagementHistory, topPosts] = await Promise.all([
        AnalyticsSnapshot.find(dateFilter).sort({ createdAt: -1 }).lean(),
        EngagementHistory.find(dateFilter).sort({ date: 1 }).lean(),
        Post.find({ creatorId: req.params.creatorId }).sort({ views: -1 }).limit(10).lean(),
    ]);

    const accountMeta = {
        username: creator.username,
        platform: creator.platform,
        exportedAt: new Date().toISOString(),
    };

    if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${creator.username}-${Date.now()}.pdf"`);

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        doc.fontSize(20).text('CreatorOS Analytics Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Account: ${accountMeta.username} (${accountMeta.platform})`);
        doc.text(`Exported: ${new Date(accountMeta.exportedAt).toLocaleString()}`);
        if (startDate || endDate) {
            doc.text(`Date Range: ${startDate || 'Start'} to ${endDate || 'End'}`);
        }
        doc.moveDown();

        if (snapshots.length > 0) {
            const latest = snapshots[0];
            doc.fontSize(14).text('Latest Snapshot', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(11);
            doc.text(`Followers: ${(latest.followers || 0).toLocaleString()}`);
            doc.text(`Following: ${(latest.following || 0).toLocaleString()}`);
            doc.text(`Total Posts: ${(latest.totalPosts || 0).toLocaleString()}`);
            doc.text(`Total Likes: ${(latest.totalLikes || 0).toLocaleString()}`);
            doc.text(`Total Comments: ${(latest.totalComments || 0).toLocaleString()}`);
            doc.text(`Total Views: ${(latest.totalViews || 0).toLocaleString()}`);
            doc.text(`Engagement Rate: ${(latest.engagementRate || 0).toFixed(2)}%`);
            doc.moveDown();
        }

        doc.fontSize(14).text('Top Performing Posts', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        if (topPosts.length > 0) {
            topPosts.forEach((post, i) => {
                const title = post.caption ? post.caption.slice(0, 60) : `${post.platform} post`;
                doc.text(`${i + 1}. ${title} | Likes: ${post.likes || 0} | Comments: ${post.comments || 0} | Views: ${post.views || 0}`);
            });
        } else {
            doc.text('No posts found.');
        }
        doc.moveDown();

        doc.fontSize(14).text('Engagement History', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
        if (engagementHistory.length > 0) {
            engagementHistory.slice(0, 30).forEach(entry => {
                const date = new Date(entry.date).toLocaleDateString();
                doc.text(`${date} | Growth: ${entry.followersGrowth || 0} | Engagement Delta: ${entry.engagementRateDelta || 0}`);
            });
        } else {
            doc.text('No engagement history found.');
        }

        doc.end();
        return;
    }

    // CSV export
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${creator.username}-${Date.now()}.csv"`);

    const csvLines = [];
    csvLines.push('CreatorOS Analytics Export');
    csvLines.push(`Account,${accountMeta.username}`);
    csvLines.push(`Platform,${accountMeta.platform}`);
    csvLines.push(`Exported At,${accountMeta.exportedAt}`);
    if (startDate || endDate) {
        csvLines.push(`Date Range,"${startDate || ''} to ${endDate || ''}"`);
    }
    csvLines.push('');

    csvLines.push('--- Snapshots ---');
    csvLines.push('Date,Followers,Following,Posts,Likes,Comments,Views,Engagement Rate');
    snapshots.forEach(s => {
        csvLines.push([
            new Date(s.createdAt).toISOString(),
            s.followers || 0,
            s.following || 0,
            s.totalPosts || 0,
            s.totalLikes || 0,
            s.totalComments || 0,
            s.totalViews || 0,
            (s.engagementRate || 0).toFixed(2) + '%',
        ].join(','));
    });
    csvLines.push('');

    csvLines.push('--- Top Posts ---');
    csvLines.push('Title,Type,Likes,Comments,Views');
    topPosts.forEach(p => {
        const title = (p.caption || `${p.platform} post`).replace(/,/g, ';');
        csvLines.push([
            `"${title.slice(0, 60)}"`,
            p.platform,
            p.likes || 0,
            p.comments || 0,
            p.views || 0,
        ].join(','));
    });
    csvLines.push('');

    csvLines.push('--- Engagement History ---');
    csvLines.push('Date,Followers Growth,Engagement Rate Delta');
    engagementHistory.forEach(e => {
        csvLines.push([
            new Date(e.date).toISOString(),
            e.followersGrowth || 0,
            e.engagementRateDelta || 0,
        ].join(','));
    });

    res.send(csvLines.join('\n'));
});

module.exports = { getSnapshots, getLatestSnapshot, triggerRefresh, getEngagementHistory, exportAnalytics };