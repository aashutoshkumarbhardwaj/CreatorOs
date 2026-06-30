const { nanoid } = require('nanoid');
const shortid = require('shortid');
const QRCode = require('qrcode');
const Url = require('../model/url');
const { isValidUrl } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @function deriveTitle
 * @description Extracts or derives a meaningful title from a given URL.
 * @returns {any}
 */
function deriveTitle(redirectUrl, fallback) {
    if (fallback) return fallback;
    try {
        const parsed = new URL(redirectUrl);
        const slug = parsed.pathname.split('/').filter(Boolean).pop();
        if (slug) {
            return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }
        return parsed.hostname.replace('www.', '');
    } catch (_) {
        return 'Untitled Link';
    }
}

/**
 * @function formatClicks
 * @description Formats raw click count numbers into a human-readable string (e.g., 1.2k).
 * @returns {any}
 */
function formatClicks(count) {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return String(count);
}

/**
 * @function serializeLink
 * @description Serializes a link object for API responses.
 * @returns {any}
 */
function serializeLink(entry, hostBase) {
    const linkedAt = entry.linkedAt || entry.createdAt?.[0]?.timeStamp || new Date();
    return {
        shortId: entry.shortId,
        redirectUrl: entry.redirectUrl,
        title: entry.title || deriveTitle(entry.redirectUrl),
        tag: entry.tag || 'active',
        totalClicks: entry.totalClicks || 0,
        clicksLabel: formatClicks(entry.totalClicks || 0),
        shortUrl: `${hostBase}/u/${entry.shortId}`,
        linkedAt: linkedAt,
        linkedAtLabel: new Date(linkedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }),
    };
}

/**
 * @function handleGenerateShortUrl
 * @description Handles the generation of a new shortened URL.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function handleGenerateShortUrl(req, res) {
    const { redirectUrl, title, customSlug, tag } = req.body;

    let shortId = shortid();
    if (customSlug) {
        const slug = String(customSlug).trim().toLowerCase();
        const existing = await Url.findOne({ shortId: slug });
        if (existing) {
            return res.status(409).json({ error: 'That slug is already taken. Try another.' });
        }
        shortId = slug;
    } else {
        let retries = 0;
        const MAX_RETRIES = 5;
        let existing = await Url.findOne({ shortId });
        
        while (existing && retries < MAX_RETRIES) {
            shortId = shortid();
            existing = await Url.findOne({ shortId });
            retries++;
        }
        
        if (existing) {
            return res.status(500).json({ error: 'Failed to generate a unique short URL. Please try again later.' });
        }
    }

    const allowedTags = ['active', 'social', 'campaign', 'general'];
    const linkTag = allowedTags.includes(tag) ? tag : 'active';

    const entry = await Url.create({
        shortId,
        redirectUrl,
        userId: req.user?.id || null,
        title: deriveTitle(redirectUrl, title?.trim()),
        tag: linkTag,
        linkedAt: new Date(),
    });

    const hostBase = `${req.protocol}://${req.get('host')}`;

    return res.status(201).json({
        message: 'Link created successfully',
        link: serializeLink(entry, hostBase),
    });
}

/**
 * @function handleListUserLinks
 * @description Retrieves and returns a list of URLs created by the authenticated user.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function handleListUserLinks(req, res) {
    const hostBase = `${req.protocol}://${req.get('host')}`;
    const userId = req.user?.id;

    const entries = await Url.listForUser(userId, 100);

    const links = entries.map((entry) => serializeLink(entry, hostBase));
    const totalClicks = links.reduce((sum, link) => sum + link.totalClicks, 0);
    const topLink = links.reduce(
        (best, link) => (link.totalClicks > (best?.totalClicks || 0) ? link : best),
        null
    );

    return res.json({
        links,
        stats: {
            totalLinks: links.length,
            totalClicks,
            totalClicksLabel: formatClicks(totalClicks),
            topLinkTitle: topLink?.title || '—',
            topLinkClicks: topLink?.clicksLabel || '0',
        },
        domain: hostBase.replace(/^https?:\/\//, ''),
    });
}


/**
 * Helper function to generate a Base64 Data URL for the QR code server-side.
 */
/**
 * @function generateBase64QR
 * @description Generates a base64 encoded QR code image for a given URL.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const generateBase64QR = async (text, fg, bg) => {
    return await QRCode.toDataURL(text, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 300,
        color: { dark: fg, light: bg }
    });
};

// ── Render Home Page (Dashboard) with Pagination ──────────────────────────────
const handleRenderDashboard = asyncHandler(async (req, res) => {
    // Implement cursor-based pagination for performance
    // Prevent loading entire collection into memory on large datasets
    const pageSize = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const cursor = req.query.cursor;

    const userId = req.user?.id || null;
    const query = cursor ? { _id: { $lt: cursor }, userId } : { userId };
    const allUrls = await Url.find(query)
        .sort({ _id: -1 })
        .limit(pageSize + 1)
        .lean();

    const hasNextPage = allUrls.length > pageSize;
    const urls = allUrls.slice(0, pageSize);
    const nextCursor = hasNextPage ? urls[urls.length - 1]?._id : null;

    return res.render("home", {
        urls: urls,
        nextCursor: nextCursor,
        hasMore: hasNextPage,
        id: null,
        shortUrl: null,
        qrCode: null,
        campaignName: "",
        error: null
    });
});

// ── Shorten and Re-render Template ───────────────────────────────────────────
const handleGenerateShortUrlRender = asyncHandler(async (req, res) => {
    const { redirectUrl, url, campaignName, qrFgColor, qrBgColor } = req.body;
    const inputUrl = redirectUrl || url;

    if (!inputUrl || !isValidUrl(inputUrl)) {
        // Implement cursor-based pagination to avoid loading all records
        const pageSize = 20;
        const allUrls = await Url.find({ userId: req.user?.id || null })
            .sort({ _id: -1 })
            .limit(pageSize)
            .lean();

        return res.status(400).render("home", {
            urls: allUrls,
            error: "A valid HTTP or HTTPS URL is required",
            id: null,
            shortUrl: null,
            qrCode: null, 
            campaignName: ""
        });
    }

    const shortId = nanoid(8);
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const shortUrl = `${baseUrl}/u/${shortId}`;
    
    const fgColor = qrFgColor || "#1a1a1a";
    const bgColor = qrBgColor || "#ffffff";

    // DB Record
    await Url.create({
        shortId,
        redirectUrl: inputUrl,
        campaignName: campaignName || "Untitled Campaign",
        qrFgColor: fgColor,
        qrBgColor: bgColor,
        qrGenerated: true,
        userId: req.user?.id || null,
    });

    const qrCodeDataUrl = await generateBase64QR(shortUrl, fgColor, bgColor);
    // Implement cursor-based pagination to prevent full table scans
    const pageSize = 20;
    const allUrls = await Url.find({ userId: req.user?.id || null })
        .sort({ _id: -1 })
        .limit(pageSize)
        .lean();

    return res.render("home", {
        urls: allUrls,
        id: shortId,
        shortUrl: shortUrl,
        qrCode: qrCodeDataUrl,
        campaignName: campaignName || "Untitled Campaign",
        error: null
    });
});

// ── Server-Generated SVG QR Code Route ───────────────────────────────────────
const handleGetQRCode = asyncHandler(async (req, res) => {
    const { shortId } = req.params;
    const entry = await Url.findOne({ shortId });

    if (!entry) {
        return res.status(404).json({ success: false, message: "Short URL not found", error: "Short URL not found" });
    }

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const shortUrl = `${baseUrl}/u/${shortId}`;

    const svgString = await QRCode.toString(shortUrl, {
        type: "svg",
        color: {
            dark:  entry.qrFgColor || "#1a1a1a",
            light: entry.qrBgColor || "#ffffff",
        },
        errorCorrectionLevel: "M",
        margin: 2,
        width:  256,
    });

    Url.findOneAndUpdate(
        { shortId },
        { $set: { qrGenerated: true } }
    ).catch((e) => console.error("[QR flag update error]", e));

    res.set("Content-Type",  "image/svg+xml");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(svgString);
});

// ── Server-Generated Download PNG Asset ──────────────────────────────────────
const handleDownloadQRCode = asyncHandler(async (req, res) => {
    const { shortId } = req.params;
    const entry = await Url.findOne({ shortId });

    if (!entry) {
        return res.status(404).json({ success: false, message: "Short URL not found", error: "Short URL not found" });
    }

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const shortUrl = `${baseUrl}/u/${shortId}`;

    const pngBuffer = await QRCode.toBuffer(shortUrl, {
        type: "png",
        color: {
            dark:  entry.qrFgColor || "#1a1a1a",
            light: entry.qrBgColor || "#ffffff",
        },
        errorCorrectionLevel: "M",
        margin: 2,
        width:  512,
    });

    res.set("Content-Type",        "image/png");
    res.set("Content-Disposition", `attachment; filename="qr-${shortId}.png"`);
    res.set("Cache-Control",       "public, max-age=3600");
    return res.send(pngBuffer);
});

// ── Color API Endpoint Updater ────────────────────────────────────────────────
const handleUpdateQRColors = asyncHandler(async (req, res) => {
    const { shortId } = req.params;
    const { qrFgColor, qrBgColor } = req.body;

    const updated = await Url.findOneAndUpdate(
        { shortId },
        {
            $set: {
                ...(qrFgColor && { qrFgColor }),
                ...(qrBgColor && { qrBgColor }),
            },
        },
        { new: true }
    );

    if (!updated) {
        return res.status(404).json({ success: false, message: "Short URL not found", error: "Short URL not found" });
    }

    return res.json({
        success: true,
        message:   "QR colors updated",
        qrFgColor: updated.qrFgColor,
        qrBgColor: updated.qrBgColor,
    });
});

// ── Get Click Metrics ────────────────────────────────────────────────────────
const handleGetAnalytics = asyncHandler(async (req, res) => {
    const { shortId } = req.params;
    const entry = await Url.findOne({ shortId });

    if (!entry) {
        return res.status(404).json({ success: false, message: "Short URL not found", error: "Short URL not found" });
    }

    if (entry.userId?.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: "Unauthorized to view these analytics", error: "Unauthorized to view these analytics" });
    }

    const qrClicks     = entry.visitHistory ? entry.visitHistory.filter((v) => v.source === "qr").length : 0;
    const directClicks = entry.visitHistory ? entry.visitHistory.filter((v) => v.source === "direct").length : 0;

    return res.json({
        totalClicks:  entry.totalClicks || 0,
        qrClicks,
        directClicks,
        qrGenerated:  entry.qrGenerated || false,
        qrFgColor:    entry.qrFgColor || "#1a1a1a",
        qrBgColor:    entry.qrBgColor || "#ffffff",
        visitHistory: entry.visitHistory || [],
        createdAt:    entry.createdAt,
    });
});

module.exports = {
    handleRenderDashboard,
    handleGenerateShortUrl,
    handleGenerateShortUrlRender,
    handleGetQRCode,
    handleDownloadQRCode,
    handleUpdateQRColors,
    handleGetAnalytics,
    handleListUserLinks,
};
