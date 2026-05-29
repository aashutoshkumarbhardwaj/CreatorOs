const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const Url = require('../model/url');
const { isValidUrl } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');

// ── Generate Short URL ────────────────────────────────────────────────────────

async function handleGenerateShortUrl(req, res) {
    try {
        const { redirectUrl, qrFgColor, qrBgColor } = req.body;

        if (!redirectUrl || !isValidUrl(redirectUrl)) {
            return res.status(400).json({
                error: "A valid HTTP or HTTPS redirectUrl is required",
            });
        }

        const shortId = nanoid(8);
        const shortUrl = `${process.env.BASE_URL}/u/${shortId}`;

        await Url.create({
            shortId,
            redirectUrl,
            qrFgColor: qrFgColor || "#000000",
            qrBgColor: qrBgColor || "#ffffff",
            qrGenerated: false,
        });

        return res.status(201).json({
            id:       shortId,
            shortUrl: shortUrl,
        });

    } catch (err) {
        console.error("[handleGenerateShortUrl]", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// ── Generate QR Code (SVG string — for embedding) ────────────────────────────

async function handleGetQRCode(req, res) {
    try {
        const { shortId } = req.params;
        const entry = await Url.findOne({ shortId });

        if (!entry) {
            return res.status(404).json({ error: "Short URL not found" });
        }

        const shortUrl = `${process.env.BASE_URL}/u/${shortId}`;

        const svgString = await QRCode.toString(shortUrl, {
            type: "svg",
            color: {
                dark:  entry.qrFgColor || "#000000",
                light: entry.qrBgColor || "#ffffff",
            },
            errorCorrectionLevel: "M",
            margin: 2,
            width:  256,
        });

        Url.findOneAndUpdate(
            { shortId },
            { $set: { qrGenerated: true } }
        ).catch((e) => console.error("[QR flag update]", e));

        res.set("Content-Type",  "image/svg+xml");
        res.set("Cache-Control", "public, max-age=3600");
        return res.send(svgString);

    } catch (err) {
        console.error("[handleGetQRCode]", err);
        return res.status(500).json({ error: "Failed to generate QR code" });
    }
}

// ── Download QR Code (PNG buffer — for file download) ────────────────────────

async function handleDownloadQRCode(req, res) {
    try {
        const { shortId } = req.params;
        const entry = await Url.findOne({ shortId });

        if (!entry) {
            return res.status(404).json({ error: "Short URL not found" });
        }

        const shortUrl = `${process.env.BASE_URL}/u/${shortId}`;

        const pngBuffer = await QRCode.toBuffer(shortUrl, {
            type: "png",
            color: {
                dark:  entry.qrFgColor || "#000000",
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

    } catch (err) {
        console.error("[handleDownloadQRCode]", err);
        return res.status(500).json({ error: "Failed to download QR code" });
    }
}

// ── Update QR Colors ──────────────────────────────────────────────────────────

async function handleUpdateQRColors(req, res) {
    try {
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

    } catch (err) {
        console.error("[handleUpdateQRColors]", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// ── Get Analytics ─────────────────────────────────────────────────────────────

async function handleGetAnalytics(req, res) {
    try {
        const { shortId } = req.params;
        const entry = await Url.findOne({ shortId });

        if (!entry) {
            return res.status(404).json({ error: "Short URL not found" });
        }

        const qrClicks     = entry.visitHistory.filter((v) => v.source === "qr").length;
        const directClicks = entry.visitHistory.filter((v) => v.source === "direct").length;

        return res.json({
            totalClicks:  entry.totalClicks,
            qrClicks,
            directClicks,
            qrGenerated:  entry.qrGenerated,
            qrFgColor:    entry.qrFgColor,
            qrBgColor:    entry.qrBgColor,
            visitHistory: entry.visitHistory,
            createdAt:    entry.createdAt,
        });

    } catch (err) {
        console.error("[handleGetAnalytics]", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────
const handleGenerateShortUrl = asyncHandler(async (req, res) => {
    const body= req.body;
    if(!body.redirectUrl || !isValidUrl(body.redirectUrl)){
        return res.status(400).json({error: "A valid HTTP or HTTPS redirectUrl is required"});
    }
    const ShortId= shortid();
    
    await Url.create({
        shortId: ShortId,
        redirectUrl: body.redirectUrl,
    });

    return res.json({id: ShortId});
});

const handleGetAnalytics = asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;
    const entry = await Url.findOne({ shortId: shortId });
    if (!entry) {
        return res.status(404).json({ error: "Short URL not found" });
    }
    return res.json({
        totalClicks: entry.totalClicks,
        analytics: entry.createdAt
    });
});

module.exports = {
    handleGenerateShortUrl,
    handleGetQRCode,
    handleDownloadQRCode,
    handleUpdateQRColors,
    handleGetAnalytics,
};
