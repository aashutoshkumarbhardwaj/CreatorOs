const { nanoid } = require('nanoid');
const shortid = require('shortid');
const QRCode = require('qrcode');
const dns = require('dns');
const net = require('net');
const mongoose = require('mongoose');
const Url = require('../model/url');
const { isValidUrl } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');

const DEFAULT_LINK_LIST_LIMIT = 20;
const MAX_LINK_LIST_LIMIT = 100;

function parseListLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LINK_LIST_LIMIT;
    return Math.min(parsed, MAX_LINK_LIST_LIMIT);
}

function isPrivateIP(ip) {
    if (net.isIPv6(ip)) {
        return ip === '::1' || ip === '0:0:0:0:0:0:0:1';
    }
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 100.64.0.0/10 (CGNAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 198.18.0.0/15 (benchmarking)
    if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return true;
    return false;
}

function isSSRFBlocked(hostname) {
    // Block bare IP addresses in private ranges
    if (net.isIP(hostname)) {
        return isPrivateIP(hostname);
    }
    return false;
}

async function validateURL(urlString) {
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch {
        throw new Error('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS URLs are allowed');
    }

    const hostname = parsed.hostname.toLowerCase();

    if (isSSRFBlocked(hostname)) {
        throw new Error('URL points to a private or internal network address');
    }

    // Resolve hostname to IP addresses and check each one
    const addresses = await new Promise((resolve) => {
        dns.lookup(hostname, { all: true }, (err, addrs) => {
            if (err) resolve([]);
            else resolve(addrs.map(a => a.address));
        });
    });

    for (const addr of addresses) {
        if (isPrivateIP(addr)) {
            throw new Error('URL resolves to a private or internal network address');
        }
    }
}

async function fetchWebsiteTitle(url, fallback) {
    if (fallback) return fallback;
    try {
        await validateURL(url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timeoutId);
        if (!response.ok) return deriveTitle(url);
        const text = await response.text();
        const match = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (match && match[1]) {
            return match[1].trim().replace(/\s+/g, ' ');
        }
        return deriveTitle(url);
    } catch (e) {
        return deriveTitle(url);
    }
}

/**
 * @function deriveTitle
 * @description Extracts or derives a meaningful title from a given URL.
 * @returns {any}
 */
function deriveTitle(redirectUrl, fallback) {
    if (fallback) return fallback;
    try {
        const parsed = new URL(redirectUrl);
        const parts = parsed.pathname.split('/').filter(Boolean);
        let slug = parts.pop();
        if (slug && ['description', 'index', 'home', 'page'].includes(slug.toLowerCase())) {
            slug = parts.pop() || slug;
        }
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
async function handleGenerateShortURL(req, res) {
    // The Zod schema accepts either `redirectUrl` or `url` as an alias;
    // normalize here so the rest of the function only deals with one field.
    const { redirectUrl: redirectUrlField, url, title, customSlug, tag } = req.body;
    const redirectUrl = redirectUrlField || url;

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

    let entry;
    try {
        entry = await Url.create({
            shortId,
            redirectUrl,
            userId: req.user?.id || null,
            title: await fetchWebsiteTitle(redirectUrl, title?.trim()),
            tag: linkTag,
            linkedAt: new Date(),
        });
    } catch (err) {
        // TOCTOU: two concurrent requests can both pass the findOne() check
        // above before either create() resolves. The unique index on
        // shortId (see model/url.js) is the real guard against duplicates;
        // this catch turns the resulting MongoDB E11000 error into a clean
        // 409 instead of an unhandled 500.
        if (err && err.code === 11000) {
            return res.status(409).json({ error: 'That slug is already taken. Try another.' });
        }
        throw err;
    }

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
    const limit = parseListLimit(req.query?.limit);
    const cursor = req.query?.cursor || null;

    const entries = await Url.listForUser(userId, { limit: limit + 1, cursor });
    const hasMore = entries.length > limit;
    const pageEntries = hasMore ? entries.slice(0, limit) : entries;

    const links = pageEntries.map((entry) => serializeLink(entry, hostBase));
    const userStats = await Url.getStatsForUser(userId);

    return res.json({
        links,
        stats: {
            totalLinks: userStats.totalLinks,
            totalClicks: userStats.totalClicks,
            totalClicksLabel: formatClicks(userStats.totalClicks),
            topLinkTitle: userStats.topLink?.title || (userStats.topLink ? deriveTitle(userStats.topLink.redirectUrl) : '—'),
            topLinkClicks: formatClicks(userStats.topLink?.totalClicks || 0),
        },
        domain: hostBase.replace(/^https?:\/\//, ''),
        pagination: {
            limit,
            hasMore,
            nextCursor: hasMore ? pageEntries[pageEntries.length - 1]?._id?.toString?.() || null : null,
        },
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
    const pageSize = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 per page
    const cursor = req.query.cursor;

    if (cursor && !mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).render("home", {
            urls: [],
            nextCursor: null,
            hasMore: false,
            id: null,
            shortUrl: null,
            qrCode: null,
            campaignName: "",
            error: "Invalid pagination cursor"
        });
    }

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
        title: await fetchWebsiteTitle(inputUrl),
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

    if (entry.userId?.toString() !== req.user?.id) {
        return res.status(403).json({ success: false, message: "Not your URL", error: "Not your URL" });
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

    if (entry.userId?.toString() !== req.user?.id) {
        return res.status(403).json({ success: false, message: "Not your URL", error: "Not your URL" });
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

    const entry = await Url.findOne({ shortId });

    if (!entry) {
        return res.status(404).json({ success: false, message: "Short URL not found", error: "Short URL not found" });
    }

    if (entry.userId?.toString() !== req.user?.id) {
        return res.status(403).json({ success: false, message: "Not your URL", error: "Not your URL" });
    }

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

    if (entry.userId && entry.userId?.toString() !== req.user?.id) {
        return res.status(403).json({ success: false, message: "Unauthorized to view these analytics", error: "Unauthorized to view these analytics" });
    }

    const qrClicks     = entry.visitHistory ? entry.visitHistory.filter((v) => v.source === "qr").length : 0;
    const directClicks = entry.visitHistory ? entry.visitHistory.filter((v) => v.source === "direct").length : 0;

    // Exclude sensitive coordinate data from visitHistory before returning
    const sanitizedHistory = (entry.visitHistory || []).map(v => ({
        timestamp: v.timestamp,
        source: v.source
    }));

    return res.json({
        totalClicks:  entry.totalClicks || 0,
        qrClicks,
        directClicks,
        qrGenerated:  entry.qrGenerated || false,
        qrFgColor:    entry.qrFgColor || "#1a1a1a",
        qrBgColor:    entry.qrBgColor || "#ffffff",
        visitHistory: sanitizedHistory,
        createdAt:    entry.createdAt,
    });
});

// ── Delete Short URL ──────────────────────────────────────────────────────────
const handleDeleteShortURL = asyncHandler(async (req, res) => {
    const { shortId } = req.params;
    const entry = await Url.findOne({ shortId });

    if (!entry) {
        return res.status(404).json({ success: false, message: "Short URL not found", error: "Short URL not found" });
    }

    if (entry.userId && entry.userId?.toString() !== req.user?.id) {
        return res.status(403).json({ success: false, message: "Unauthorized to delete this URL", error: "Unauthorized to delete this URL" });
    }

    if (Url.findByIdAndDelete) {
        await Url.findByIdAndDelete(entry._id || shortId);
    } else if (Url.deleteOne) {
        await Url.deleteOne({ shortId });
    }

    return res.json({
        success: true,
        message: "Short URL deleted successfully",
    });
});

module.exports = {
    handleRenderDashboard,
    handleGenerateShortURL,
    handleGenerateShortUrlRender,
    handleGetQRCode,
    handleDownloadQRCode,
    handleUpdateQRColors,
    handleGetAnalytics,
    handleListUserLinks,
    handleDeleteShortURL,
};
