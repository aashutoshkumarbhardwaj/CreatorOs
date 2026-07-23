const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const { ZipArchive } = require('archiver');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const QrCode = require('../model/qrCode');
const User = require('../model/user');
const services = require('../services.config');
const asyncHandler = require('../utils/asyncHandler');
const { isValidUrl } = require('../utils/validators');
const {
    resolveErrorCorrection,
    buildEncodedUrl,
    generateSvg,
    generatePng,
    generatePdf,
    parseDeviceFromUa,
} = require('../utils/qrGenerator');

const BATCH_SIZE_CAP = 50;
const PATTERN_PRESETS = ['A', 'B', 'C', 'D', 'E'];
const INPUT_TYPES = ['url', 'text'];
const TEXT_QR_MAX_LENGTH = 2000;

/**
 * In-memory rate limiter for QR create/batch (avoid rate-limit-mongo + mongodb+srv issues).
 */
const qrWriteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    keyGenerator: (req) => (req.user?.id ? `qr-user:${req.user.id}` : ipKeyGenerator(req.ip)),
    handler: (req, res) => {
        const message = 'Too many QR code requests. Please try again later.';
        return res.status(429).json({ success: false, message, error: message });
    },
});

/**
 * @function buildAccountViewModel
 * @description Builds the sidebar/topbar account view model.
 * @param {object|null} userDoc
 * @param {object} fallbackUser
 * @returns {object}
 */
function buildAccountViewModel(userDoc, fallbackUser) {
    const name = userDoc?.name || fallbackUser?.name || 'Creator';
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'CR';

    return {
        id: fallbackUser?.id,
        name,
        email: userDoc?.email || fallbackUser?.email || '',
        initials,
    };
}

/**
 * @function getBaseUrl
 * @description Resolves the public base URL for encoded redirect links.
 * @param {object} req
 * @returns {string}
 */
function getBaseUrl(req) {
    return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

/**
 * @function normalizeDesign
 * @description Sanitizes design payload from the client.
 * @param {object} raw
 * @returns {object}
 */
function normalizeDesign(raw = {}) {
    const foregroundColor = typeof raw.foregroundColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.foregroundColor)
        ? raw.foregroundColor
        : '#000000';
    const backgroundColor = typeof raw.backgroundColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.backgroundColor)
        ? raw.backgroundColor
        : '#FFFFFF';
    const patternPreset = PATTERN_PRESETS.includes(raw.patternPreset) ? raw.patternPreset : 'A';
    const logoUrl = typeof raw.logoUrl === 'string' && isValidUrl(raw.logoUrl) ? raw.logoUrl : null;

    return {
        foregroundColor,
        backgroundColor,
        patternPreset,
        logoUrl,
        errorCorrectionLevel: resolveErrorCorrection({ logoUrl, errorCorrectionLevel: raw.errorCorrectionLevel }),
    };
}

/**
 * @function normalizeInputType
 * @description Normalizes the QR payload type.
 * @param {string} raw
 * @returns {'url'|'text'}
 */
function normalizeInputType(raw) {
    return INPUT_TYPES.includes(raw) ? raw : 'url';
}

/**
 * @function normalizeCampaignName
 * @description Sanitizes campaign metadata for future campaign grouping.
 * @param {string} value
 * @returns {string}
 */
function normalizeCampaignName(value) {
    return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

/**
 * @function serializeQr
 * @description Serializes a QR document for JSON/HTML consumers.
 * @param {object} doc
 * @param {string} baseUrl
 * @returns {object}
 */
function serializeQr(doc, baseUrl) {
    const id = doc._id?.toString();
    const shortUrl = doc.shortId ? `${baseUrl.replace(/\/$/, '')}/q/${doc.shortId}` : null;
    return {
        id,
        label: doc.label || '',
        inputType: doc.inputType || 'url',
        campaignName: doc.campaignName || '',
        targetUrl: doc.targetUrl,
        isDynamic: Boolean(doc.isDynamic),
        shortId: doc.shortId || null,
        shortUrl,
        encodedUrl: buildEncodedUrl(doc, baseUrl),
        design: doc.design || {},
        batchId: doc.batchId ? doc.batchId.toString() : null,
        totalScans: doc.totalScans || 0,
        formats: doc.formats || { svg: false, png: false, pdf: false },
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        exportLinks: {
            png: `/services/qr-code-generator/${id}/export?format=png`,
            svg: `/services/qr-code-generator/${id}/export?format=svg`,
            pdf: `/services/qr-code-generator/${id}/export?format=pdf`,
        },
    };
}

/**
 * @function buildTelemetry
 * @description Aggregates scan telemetry across the user's QR library.
 * @param {object[]} qrDocs
 * @returns {object}
 */
function buildTelemetry(qrDocs) {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    let scans24h = 0;
    const feed = [];

    for (const qr of qrDocs) {
        const history = Array.isArray(qr.scanHistory) ? qr.scanHistory : [];
        for (const scan of history) {
            const ts = new Date(scan.timestamp || 0).getTime();
            if (ts >= dayAgo) scans24h += 1;
            feed.push({
                linkId: qr.shortId || qr._id?.toString()?.slice(-6) || '—',
                location: [scan.city, scan.country].filter(Boolean).join(', ') || 'Unknown',
                device: scan.device || 'Unknown',
                timestamp: scan.timestamp,
            });
        }
    }

    feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        scans24h,
        // TODO: wire a real conversion metric when post-scan goals exist
        conversionRate: null,
        conversionRateLabel: 'N/A',
        systemStatus: 'Operational',
        activeLinks: qrDocs.filter((q) => q.isDynamic && q.shortId).length,
        recentScans: feed.slice(0, 20),
    };
}

/**
 * @function fetchTelemetryForUser
 * @description Loads the user's QR docs and computes the live telemetry snapshot.
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function fetchTelemetryForUser(userId) {
    const qrDocs = await QrCode.listForUser(userId, 100);
    return buildTelemetry(qrDocs);
}

/**
 * @function parseBatchUrls
 * @description Splits textarea/CSV input into URL candidates.
 * @param {string|string[]} input
 * @returns {string[]}
 */
function parseBatchUrls(input) {
    if (Array.isArray(input)) {
        return input.map((u) => String(u).trim()).filter(Boolean);
    }
    return String(input || '')
        .split(/[\n,]+/)
        .map((u) => u.trim())
        .filter(Boolean);
}

/**
 * @function createUniqueShortId
 * @description Generates a unique shortId for dynamic QR redirects.
 * @returns {Promise<string>}
 */
async function createUniqueShortId() {
    for (let i = 0; i < 8; i += 1) {
        const shortId = nanoid(8);
        const existing = await QrCode.findOne({ shortId }).lean();
        if (!existing) return shortId;
    }
    throw new Error('Failed to allocate a unique short id');
}

/**
 * @function createQrDocument
 * @description Creates and persists a single QR code document.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function createQrDocument({
    userId,
    targetUrl,
    label,
    inputType,
    campaignName,
    isDynamic,
    design,
    batchId,
}) {
    const shortId = isDynamic ? await createUniqueShortId() : null;
    const doc = await QrCode.create({
        userId,
        label: label || '',
        inputType: inputType || 'url',
        campaignName: campaignName || '',
        targetUrl,
        isDynamic,
        shortId,
        design,
        batchId: batchId || null,
        formats: { svg: true, png: true, pdf: false },
    });
    return doc;
}

/**
 * @function renderQrGeneratorPage
 * @description GET /services/qr-code-generator — wizard UI + library + telemetry.
 * @param {object} req
 * @param {object} res
 */
const renderQrGeneratorPage = asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id).select('name email').lean();
    const qrDocs = await QrCode.listForUser(req.user.id, 100);
    const baseUrl = getBaseUrl(req);
    const service = services.find((s) => s.key === 'qr-code-generator');

    return res.render('qr-code-generator', {
        service,
        services,
        user: buildAccountViewModel(userDoc, req.user),
        qrCodes: qrDocs.map((doc) => serializeQr(doc, baseUrl)),
        telemetry: buildTelemetry(qrDocs),
        csrfToken: res.locals.csrfToken,
    });
});

/**
 * @function createQrCode
 * @description POST /services/qr-code-generator/create
 * @param {object} req
 * @param {object} res
 */
const createQrCode = asyncHandler(async (req, res) => {
    const {
        targetUrl,
        text,
        inputType: rawInputType,
        label,
        campaignName,
        isDynamic = true,
        design: rawDesign,
        autoShortLink,
    } = req.body || {};

    const inputType = normalizeInputType(rawInputType);
    const encodedContent = inputType === 'text' ? String(text || targetUrl || '').trim() : String(targetUrl || '').trim();

    if (inputType === 'url' && (!encodedContent || !isValidUrl(encodedContent))) {
        return res.status(400).json({
            success: false,
            message: 'A valid HTTP or HTTPS target URL is required',
            error: 'A valid HTTP or HTTPS target URL is required',
        });
    }

    if (inputType === 'text' && (!encodedContent || encodedContent.length > TEXT_QR_MAX_LENGTH)) {
        return res.status(400).json({
            success: false,
            message: `Text QR content must be between 1 and ${TEXT_QR_MAX_LENGTH} characters`,
            error: `Text QR content must be between 1 and ${TEXT_QR_MAX_LENGTH} characters`,
        });
    }

    const dynamic = inputType === 'url' && isDynamic !== false && autoShortLink !== false;
    const design = normalizeDesign(rawDesign || {});
    const doc = await createQrDocument({
        userId: req.user.id,
        targetUrl: encodedContent,
        inputType,
        label: typeof label === 'string' ? label.trim().slice(0, 120) : '',
        campaignName: normalizeCampaignName(campaignName),
        isDynamic: dynamic,
        design,
    });

    const baseUrl = getBaseUrl(req);
    return res.status(201).json({
        success: true,
        message: 'QR code created',
        qrCode: serializeQr(doc.toObject ? doc.toObject() : doc, baseUrl),
    });
});

/**
 * @function batchCreateQrCodes
 * @description POST /services/qr-code-generator/batch — create many + zip download.
 * @param {object} req
 * @param {object} res
 */
const batchCreateQrCodes = asyncHandler(async (req, res) => {
    const { urls: rawUrls, design: rawDesign, isDynamic = true, labelPrefix, campaignName } = req.body || {};
    const candidates = parseBatchUrls(rawUrls);

    if (!candidates.length) {
        return res.status(400).json({
            success: false,
            message: 'Provide at least one URL',
            error: 'Provide at least one URL',
        });
    }

    if (candidates.length > BATCH_SIZE_CAP) {
        return res.status(400).json({
            success: false,
            message: `Batch size capped at ${BATCH_SIZE_CAP} URLs per request`,
            error: `Batch size capped at ${BATCH_SIZE_CAP} URLs per request`,
        });
    }

    const design = normalizeDesign(rawDesign || {});
    const batchId = new mongoose.Types.ObjectId();
    const baseUrl = getBaseUrl(req);
    const created = [];
    const failed = [];

    for (let i = 0; i < candidates.length; i += 1) {
        const url = candidates[i];
        if (!isValidUrl(url)) {
            failed.push({ url, reason: 'Invalid URL' });
            continue;
        }
        try {
            const doc = await createQrDocument({
                userId: req.user.id,
                targetUrl: url,
                inputType: 'url',
                label: labelPrefix ? `${labelPrefix} ${i + 1}` : '',
                campaignName: normalizeCampaignName(campaignName),
                isDynamic: isDynamic !== false,
                design,
                batchId,
            });
            created.push(doc);
        } catch (err) {
            failed.push({ url, reason: err.message || 'Create failed' });
        }
    }

    if (!created.length) {
        return res.status(400).json({
            success: false,
            message: 'No valid URLs could be processed',
            error: 'No valid URLs could be processed',
            failed,
        });
    }

    // Stream a zip of PNG + SVG for each created code
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="qr-batch-${batchId.toString().slice(-8)}.zip"`
    );
    res.setHeader('X-QR-Created-Count', String(created.length));
    res.setHeader('X-QR-Failed-Count', String(failed.length));
    // Expose failed list via header for small batches (UI also gets JSON alternative via Accept)
    if (failed.length) {
        res.setHeader('X-QR-Failed', encodeURIComponent(JSON.stringify(failed.slice(0, 20))));
    }

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') return;
        throw err;
    });
    archive.on('error', (err) => {
        throw err;
    });
    archive.pipe(res);

    for (const doc of created) {
        const plain = doc.toObject ? doc.toObject() : doc;
        const nameBase = (plain.label || plain.shortId || plain._id.toString()).replace(/[^\w.-]+/g, '_');
        const png = await generatePng(plain, baseUrl);
        const svg = await generateSvg(plain, baseUrl);
        archive.append(png, { name: `${nameBase}.png` });
        archive.append(svg, { name: `${nameBase}.svg` });
    }

    await archive.finalize();
});

/**
 * @function exportQrCode
 * @description GET /services/qr-code-generator/:id/export?format=png|svg|pdf
 * @param {object} req
 * @param {object} res
 */
const exportQrCode = asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'png').toLowerCase();
    if (!['png', 'svg', 'pdf'].includes(format)) {
        return res.status(400).json({
            success: false,
            message: 'format must be png, svg, or pdf',
            error: 'format must be png, svg, or pdf',
        });
    }

    const doc = await QrCode.findById(req.params.id);
    if (!doc) {
        return res.status(404).json({ success: false, message: 'QR code not found', error: 'QR code not found' });
    }
    if (doc.userId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your QR code', error: 'Not your QR code' });
    }

    const baseUrl = getBaseUrl(req);
    const filename = (doc.label || doc.shortId || doc._id.toString()).replace(/[^\w.-]+/g, '_');

    if (format === 'svg') {
        const svg = await generateSvg(doc, baseUrl);
        await QrCode.updateOne({ _id: doc._id }, { $set: { 'formats.svg': true } });
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.svg"`);
        return res.send(svg);
    }

    if (format === 'png') {
        const png = await generatePng(doc, baseUrl);
        await QrCode.updateOne({ _id: doc._id }, { $set: { 'formats.png': true } });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.png"`);
        return res.send(png);
    }

    const pdf = await generatePdf(doc, baseUrl);
    await QrCode.updateOne({ _id: doc._id }, { $set: { 'formats.pdf': true } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    return res.send(pdf);
});

/**
 * @function updateQrCode
 * @description PATCH /services/qr-code-generator/:id — update target/design on dynamic QRs.
 * @param {object} req
 * @param {object} res
 */
const updateQrCode = asyncHandler(async (req, res) => {
    const doc = await QrCode.findById(req.params.id);
    if (!doc) {
        return res.status(404).json({ success: false, message: 'QR code not found', error: 'QR code not found' });
    }
    if (doc.userId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your QR code', error: 'Not your QR code' });
    }

    const { targetUrl, label, campaignName, design: rawDesign } = req.body || {};

    if (targetUrl !== undefined) {
        if ((doc.inputType || 'url') !== 'url') {
            return res.status(400).json({
                success: false,
                message: 'Text QR content cannot be changed without regenerating the printed QR image',
                error: 'Text QR content cannot be changed without regenerating the printed QR image',
            });
        }
        if (!isValidUrl(targetUrl)) {
            return res.status(400).json({
                success: false,
                message: 'A valid HTTP or HTTPS target URL is required',
                error: 'A valid HTTP or HTTPS target URL is required',
            });
        }
        if (!doc.isDynamic) {
            return res.status(400).json({
                success: false,
                message: 'Static QR codes cannot change target URL without regenerating the image',
                error: 'Static QR codes cannot change target URL without regenerating the image',
            });
        }
        doc.targetUrl = targetUrl;
    }

    if (typeof label === 'string') {
        doc.label = label.trim().slice(0, 120);
    }

    if (typeof campaignName === 'string') {
        doc.campaignName = normalizeCampaignName(campaignName);
    }

    if (rawDesign && typeof rawDesign === 'object') {
        doc.design = normalizeDesign({ ...doc.design?.toObject?.() || doc.design || {}, ...rawDesign });
    }

    await doc.save();
    const baseUrl = getBaseUrl(req);
    return res.json({
        success: true,
        message: 'QR code updated',
        qrCode: serializeQr(doc.toObject(), baseUrl),
    });
});

/**
 * @function deleteQrCode
 * @description DELETE /services/qr-code-generator/:id
 * @param {object} req
 * @param {object} res
 */
const deleteQrCode = asyncHandler(async (req, res) => {
    const doc = await QrCode.findById(req.params.id);
    if (!doc) {
        return res.status(404).json({ success: false, message: 'QR code not found', error: 'QR code not found' });
    }
    if (doc.userId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your QR code', error: 'Not your QR code' });
    }

    await QrCode.deleteOne({ _id: doc._id });
    return res.json({ success: true, message: 'QR code deleted' });
});

/**
 * @function getQrAnalytics
 * @description GET /services/qr-code-generator/:id/analytics
 * @param {object} req
 * @param {object} res
 */
const getQrAnalytics = asyncHandler(async (req, res) => {
    const doc = await QrCode.findById(req.params.id).lean();
    if (!doc) {
        return res.status(404).json({ success: false, message: 'QR code not found', error: 'QR code not found' });
    }
    if (doc.userId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your QR code', error: 'Not your QR code' });
    }

    const history = Array.isArray(doc.scanHistory) ? doc.scanHistory : [];
    const buckets = {};
    for (const scan of history) {
        const day = new Date(scan.timestamp).toISOString().slice(0, 10);
        buckets[day] = (buckets[day] || 0) + 1;
    }
    const timeSeries = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

    return res.json({
        success: true,
        totalScans: doc.totalScans || 0,
        scanHistory: history.slice(0, 100),
        timeSeries,
    });
});

/**
 * @function getQrTelemetry
 * @description GET /services/qr-code-generator/telemetry — live dashboard snapshot.
 * @param {object} req
 * @param {object} res
 */
const getQrTelemetry = asyncHandler(async (req, res) => {
    const telemetry = await fetchTelemetryForUser(req.user.id);
    return res.json({
        success: true,
        telemetry,
    });
});

/**
 * @function handleQrRedirect
 * @description Public GET /q/:shortId — track scan and redirect to targetUrl.
 * @param {object} req
 * @param {object} res
 */
const handleQrRedirect = asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;

    try {
        const scanEntry = {
            timestamp: new Date(),
            ip: req.ip || null,
            // No paid geolocation in-repo — stub location gracefully
            country: null,
            city: null,
            device: parseDeviceFromUa(req.get('user-agent')),
        };

        const entry = await QrCode.findOneAndUpdate(
            { shortId, isDynamic: true },
            {
                $inc: { totalScans: 1 },
                $push: {
                    scanHistory: {
                        $each: [scanEntry],
                        $sort: { timestamp: -1 },
                        $slice: 1000,
                    },
                },
            },
            { new: true }
        );

        if (!entry) return res.status(404).send('QR code not found');
        return res.redirect(entry.targetUrl);
    } catch (err) {
        console.error('[qr-redirect]', err);
        return res.status(500).send('Server error');
    }
});

module.exports = {
    qrWriteLimiter,
    renderQrGeneratorPage,
    createQrCode,
    batchCreateQrCodes,
    exportQrCode,
    updateQrCode,
    deleteQrCode,
    getQrAnalytics,
    getQrTelemetry,
    handleQrRedirect,
};
