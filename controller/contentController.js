const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ScheduledContent = require('../model/scheduledContent');

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

    const content = await ScheduledContent.create({
        userId: req.user.id,
        caption: caption.trim(),
        mediaUrl: mediaUrl || undefined,
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
    const items = await ScheduledContent.find({ userId: req.user.id })
        .sort({ scheduledAt: -1 })
        .lean();

    return res.json({ success: true, items });
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

module.exports = { scheduleContent, listScheduledContent, cancelScheduledContent };
