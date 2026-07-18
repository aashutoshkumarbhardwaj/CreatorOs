const express = require('express');
const { getInstagramProfile } = require('../controller/instagramController');
const { verifyWebhook, verifyWebhookSignature, handleWebhook } = require('../controller/instagramWebhookController');

const router = express.Router();

const { protect } = require('../middleware/auth');
const { instagramProfileLimiter } = require('../middleware/rateLimiters');

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

const DmTrigger = require('../model/dmTrigger');
const asyncHandler = require('../utils/asyncHandler');
const protect = require('../middleware/auth');

router.get('/triggers', protect, asyncHandler(async (req, res) => {
    const triggers = await DmTrigger.find({ creatorId: req.user._id });
    res.json({ success: true, data: triggers });
}));

router.post('/triggers', protect, asyncHandler(async (req, res) => {
    const trigger = await DmTrigger.create({ ...req.body, creatorId: req.user._id });
    res.status(201).json({ success: true, data: trigger });
}));

router.delete('/triggers/:id', protect, asyncHandler(async (req, res) => {
    const trigger = await DmTrigger.findOneAndDelete({ _id: req.params.id, creatorId: req.user._id });
    if (!trigger) return res.status(404).json({ success: false, message: 'Trigger not found' });
    res.json({ success: true, message: 'Trigger deleted' });
}));

// Instagram DM Automation Webhook Endpoints
router.get('/webhook', verifyWebhook);
router.post('/webhook', verifyWebhookSignature, handleWebhook);

module.exports = router;
