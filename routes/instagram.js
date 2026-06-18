const express = require('express');
const { getInstagramProfile } = require('../controller/instagramController');
const { verifyWebhook, handleWebhook } = require('../controller/instagramWebhookController');

const router = express.Router();


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
router.get('/profile', getInstagramProfile);

// Instagram DM Automation Webhook Endpoints
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

module.exports = router;
