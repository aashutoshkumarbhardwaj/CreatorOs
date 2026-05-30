const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const Url = require('../model/url');
const { isValidUrl } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Helper function to generate a Base64 Data URL for the QR code server-side.
 */
const generateBase64QR = async (text, fg, bg) => {
    return await QRCode.toDataURL(text, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 300,
        color: { dark: fg, light: bg }
    });
};

// ── Render Home Page (Dashboard) ──────────────────────────────────────────────
const handleRenderDashboard = asyncHandler(async (req, res) => {
    const allUrls = await Url.find({}).sort({ createdAt: -1 });
    
    return res.render("home", {
        urls: allUrls,
        id: null,
        shortUrl: null,
        qrCode: null,
        campaignName: "",
        error: null
    });
});

// ── Shorten and Re-render Template ───────────────────────────────────────────
const handleGenerateShortUrl = asyncHandler(async (req, res) => {
    const { redirectUrl, url, campaignName, qrFgColor, qrBgColor } = req.body;
    const inputUrl = redirectUrl || url;

    if (!inputUrl || !isValidUrl(inputUrl)) {
        const allUrls = await Url.find({}).sort({ createdAt: -1 });
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
    const baseUrl = process.env.BASE_URL || 'http://localhost:8001';
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
    });

    const qrCodeDataUrl = await generateBase64QR(shortUrl, fgColor, bgColor);
    const allUrls = await Url.find({}).sort({ createdAt: -1 });

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
        return res.status(404).json({ error: "Short URL not found" });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:8001';
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
        return res.status(404).json({ error: "Short URL not found" });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:8001';
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

    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (qrFgColor && !hexRegex.test(qrFgColor)) {
        return res.status(400).json({ error: "Invalid qrFgColor hex value" });
    }
    if (qrBgColor && !hexRegex.test(qrBgColor)) {
        return res.status(400).json({ error: "Invalid qrBgColor hex value" });
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

    if (!updated) {
        return res.status(404).json({ error: "Short URL not found" });
    }

    return res.json({
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
        return res.status(404).json({ error: "Short URL not found" });
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
    handleGetQRCode,
    handleDownloadQRCode,
    handleUpdateQRColors,
    handleGetAnalytics,
};