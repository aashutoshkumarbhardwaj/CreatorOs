const express = require('express');
const { getInstagramProfile, verifyInstagramWebhook, handleInstagramWebhook } = require('../controller/instagramController');

const router = express.Router();

const { protect } = require('../middleware/auth');
const { instagramProfileLimiter, instagramLimiter } = require('../middleware/rateLimiters');
const { isValidObjectId } = require('mongoose');

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: GET request for /profile
 *     description: Retrieves the authenticated user's profile information.
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/profile', protect, instagramProfileLimiter, getInstagramProfile);

// ─── Meta Webhook ────────────────────────────────────────────────────────────
// GET  /api/instagram/webhook  — verification handshake from Meta
// POST /api/instagram/webhook  — incoming comment / DM events
router.get('/webhook', verifyInstagramWebhook);
router.post('/webhook', handleInstagramWebhook);

// ─── DM Trigger CRUD ─────────────────────────────────────────────────────────
const DmTrigger = require('../model/dmTrigger');
const asyncHandler = require('../utils/asyncHandler');
const { validateDmTrigger } = require('../middleware/validators/instagramValidator');

router.get('/triggers', protect, instagramLimiter, asyncHandler(async (req, res) => {
    const triggers = await DmTrigger.find({ creatorId: req.user.id }).lean();
    res.json({ success: true, data: triggers });
}));

router.post('/triggers', protect, validateDmTrigger, asyncHandler(async (req, res) => {
    const { user_id, userId, creatorId, ...safeBody } = req.body;
    const trigger = await DmTrigger.create({ ...safeBody, creatorId: req.user.id });
    res.status(201).json({ success: true, data: trigger });
}));

router.patch('/triggers/:id', protect, instagramLimiter, asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid trigger ID.' });
    }
    const { creatorId, user_id, userId, ...safeBody } = req.body;
    const trigger = await DmTrigger.findOneAndUpdate(
        { _id: req.params.id, creatorId: req.user.id },
        { $set: safeBody },
        { new: true, runValidators: true },
    );
    if (!trigger) return res.status(404).json({ success: false, message: 'Trigger not found.' });
    res.json({ success: true, data: trigger });
}));

router.delete('/triggers/:id', protect, instagramLimiter, asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid trigger ID.' });
    }
    const trigger = await DmTrigger.findOneAndDelete({ _id: req.params.id, creatorId: req.user.id });
    if (!trigger) return res.status(404).json({ success: false, message: 'Trigger not found' });
    res.json({ success: true, message: 'Trigger deleted' });
}));

module.exports = router;

