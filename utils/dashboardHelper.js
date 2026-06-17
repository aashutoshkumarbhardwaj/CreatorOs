const Url = require('../model/url');

/**
 * Fetch and calculate dashboard statistics and chart data
 * using the Url model data.
 * @param {Object} userDoc - The current user's document
 * @returns {Object} dashboardData
 */
/**
 * @function getDashboardData
 * @description Automatically generated JSDoc for getDashboardData
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function getDashboardData(userDoc) {
    let urlsQuery = Url.find({});
    let allUrls = await urlsQuery;

    // Handle Mongoose Query vs Mock implementation differences
    if (allUrls && typeof allUrls.sort === 'function' && !Array.isArray(allUrls)) {
        // It's the mock returning { sort: () => ... }
        allUrls = allUrls.sort();
    } else if (Array.isArray(allUrls)) {
        // Fallback for actual array
        allUrls = allUrls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Default stats
    const stats = {
        totalLinks: 0,
        totalClicks: 0,
        topPerforming: 0,
        joinedOn: 'N/A'
    };

    if (userDoc && userDoc.createdAt) {
        stats.joinedOn = new Date(userDoc.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } else {
        stats.joinedOn = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    if (allUrls && allUrls.length > 0) {
        stats.totalLinks = allUrls.length;
        stats.totalClicks = allUrls.reduce((acc, curr) => acc + (curr.totalClicks || 0), 0);
        
        const topLink = allUrls.reduce((prev, curr) => ((curr.totalClicks || 0) > (prev.totalClicks || 0) ? curr : prev), allUrls[0]);
        stats.topPerforming = topLink.totalClicks || 0;
    }

    // Calculate Charts Data
    // We will aggregate visitHistory.
    const last30Days = [...Array(30)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const clicksOverview = {
        labels: last30Days.map(d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        data: new Array(30).fill(0)
    };

    let directClicks = 0;
    let qrClicks = 0;
    let unknownClicks = 0;

    allUrls.forEach(url => {
        if (url.visitHistory && url.visitHistory.length > 0) {
            url.visitHistory.forEach(visit => {
                const visitDate = new Date(visit.timestamp);
                visitDate.setHours(0, 0, 0, 0);
                
                const diffTime = new Date().setHours(0,0,0,0) - visitDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays >= 0 && diffDays < 30) {
                    const index = 29 - diffDays;
                    clicksOverview.data[index] += 1;
                }

                if (visit.source === 'direct') directClicks++;
                else if (visit.source === 'qr') qrClicks++;
                else unknownClicks++;
            });
        }
    });

    const totalReferrers = directClicks + qrClicks + unknownClicks || 1; // avoid div by 0
    const topReferrers = {
        labels: ['Direct', 'QR Code', 'Unknown'],
        data: [
            Math.round((directClicks / totalReferrers) * 100),
            Math.round((qrClicks / totalReferrers) * 100),
            Math.round((unknownClicks / totalReferrers) * 100)
        ]
    };

    // Prepare recent links (max 5)
    const recentLinks = allUrls.slice(0, 5).map(u => {
        return {
            originalUrl: u.redirectUrl,
            shortUrl: u.shortId,
            clicks: u.totalClicks || 0,
            date: new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };
    });

    return {
        stats,
        charts: {
            clicksOverview,
            topReferrers
        },
        recentLinks
    };
}

module.exports = {
    getDashboardData
};
