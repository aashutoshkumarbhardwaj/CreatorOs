const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ScheduledContent = require('../model/scheduledContent');
const { isValidUrl } = require('../utils/validators');

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const VALID_STATUSES = new Set(['scheduled', 'published', 'cancelled']);

function parseListLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIST_LIMIT;
    return Math.min(parsed, MAX_LIST_LIMIT);
}

function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current.trim());
    return fields;
}

/**
 * @function scheduleContent
 * @description Creates a piece of content scheduled to auto-publish at a future UTC time.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const scheduleContent = asyncHandler(async (req, res) => {
    const { caption, mediaUrl, scheduledAt, timezone } = req.body || {};

    if (!caption || typeof caption !== 'string' || !caption.trim()) {
        return res.status(400).json({ success: false, message: 'Caption is required' });
    }

    if (!scheduledAt) {
        return res.status(400).json({ success: false, message: 'scheduledAt is required' });
    }

    // scheduledAt is expected as an ISO string; the client is responsible for
    // converting the creator's local picker time to an ISO/UTC timestamp
    // before sending it (e.g. `new Date(localValue).toISOString()`), so the
    // server only ever stores and compares UTC instants.
    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ success: false, message: 'scheduledAt must be a valid date' });
    }

    if (scheduledDate.getTime() <= Date.now()) {
        return res.status(400).json({ success: false, message: 'scheduledAt must be in the future' });
    }

    const normalizedMediaUrl = typeof mediaUrl === 'string' ? mediaUrl.trim() : mediaUrl;
    if (normalizedMediaUrl && (typeof normalizedMediaUrl !== 'string' || !isValidUrl(normalizedMediaUrl))) {
        return res.status(400).json({ success: false, message: 'mediaUrl must be a valid HTTP or HTTPS URL' });
    }

    const content = await ScheduledContent.create({
        userId: req.user.id,
        caption: caption.trim(),
        mediaUrl: normalizedMediaUrl || undefined,
        timezone: timezone || 'UTC',
        scheduledAt: scheduledDate,
        status: 'scheduled',
    });

    return res.status(201).json({ success: true, content });
});

/**
 * @function listScheduledContent
 * @description Lists the signed-in creator's scheduled and published content, newest first.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const listScheduledContent = asyncHandler(async (req, res) => {
    const limit = parseListLimit(req.query?.limit);
    const { status, cursor } = req.query || {};

    if (status && !VALID_STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status filter' });
    }

    if (cursor && !mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ success: false, message: 'Invalid cursor' });
    }

    let cursorItem = null;
    if (cursor) {
        cursorItem = await ScheduledContent.findOne({ _id: cursor, userId: req.user.id })
            .select('scheduledAt')
            .lean();

        if (!cursorItem) {
            return res.status(400).json({ success: false, message: 'Invalid cursor' });
        }
    }

    const query = {
        userId: req.user.id,
        ...(status && { status }),
        ...(cursorItem && {
            $or: [
                { scheduledAt: { $lt: cursorItem.scheduledAt } },
                { scheduledAt: cursorItem.scheduledAt, _id: { $lt: cursor } },
            ],
        }),
    };

    const results = await ScheduledContent.find(query)
        .sort({ scheduledAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean();

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?._id?.toString() || null : null;

    return res.json({
        success: true,
        items,
        pagination: {
            limit,
            hasMore,
            nextCursor,
        },
    });
});

/**
 * @function cancelScheduledContent
 * @description Cancels a piece of content that hasn't published yet.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const cancelScheduledContent = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid content id' });
    }

    const content = await ScheduledContent.findOne({ _id: req.params.id, userId: req.user.id });

    if (!content) {
        return res.status(404).json({ success: false, message: 'Scheduled content not found' });
    }

    if (content.status !== 'scheduled') {
        return res.status(400).json({ success: false, message: `Cannot cancel content with status "${content.status}"` });
    }

    content.status = 'cancelled';
    await content.save();

    return res.json({ success: true, content });
});

const bulkScheduleContent = asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'CSV file is required' });
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        return res.status(400).json({ success: false, message: 'CSV must have a header row and at least one data row' });
    }

    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const captionIdx = header.indexOf('caption');
    const mediaUrlIdx = header.indexOf('mediaurl');
    const scheduledAtIdx = header.indexOf('scheduledat');
    const accountIdIdx = header.indexOf('accountid');
    const platformIdx = header.indexOf('platform');

    if (captionIdx === -1 || scheduledAtIdx === -1) {
        return res.status(400).json({ success: false, message: 'CSV must contain "caption" and "scheduledAt" columns' });
    }

    const results = { created: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        const caption = fields[captionIdx];
        const scheduledAt = fields[scheduledAtIdx];

        if (!caption || !scheduledAt) {
            results.errors.push({ row: i + 1, reason: 'Missing caption or scheduledAt' });
            continue;
        }

        const scheduledDate = new Date(scheduledAt);
        if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
            results.errors.push({ row: i + 1, reason: 'Invalid or past scheduledAt date' });
            continue;
        }

        try {
            await ScheduledContent.create({
                userId: req.user.id,
                caption: caption.trim(),
                mediaUrl: mediaUrlIdx !== -1 ? fields[mediaUrlIdx] : undefined,
                timezone: 'UTC',
                scheduledAt: scheduledDate,
                accountId: accountIdIdx !== -1 && fields[accountIdIdx] ? fields[accountIdIdx] : undefined,
                platform: platformIdx !== -1 && fields[platformIdx] ? fields[platformIdx] : undefined,
                status: 'scheduled',
            });
            results.created++;
        } catch (err) {
            results.errors.push({ row: i + 1, reason: err.message });
        }
    }

    return res.status(201).json({ success: true, ...results });
});

module.exports = { scheduleContent, listScheduledContent, cancelScheduledContent, bulkScheduleContent };
