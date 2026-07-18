const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { handleAiRequest } = require('../controller/ai');
const { aiRequestLimiter } = require('../middleware/rateLimiters');

/**
 * @swagger
 * /api/ai/generate:
 *   post:
 *     summary: Generate content using AI
 *     description: Takes a prompt and context to generate AI-powered content suggestions, such as post ideas or captions.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The main instruction or question for the AI.
 *               context:
 *                 type: string
 *                 description: Additional context or background information for the AI.
 *     responses:
 *       200:
 *         description: AI-generated content returned successfully.
 *       400:
 *         description: Bad request, prompt is missing.
 *       429:
 *         description: Rate limit exceeded.
 *       500:
 *         description: Internal server error or AI service failure.
 */
router.post('/generate', protect, aiRequestLimiter, handleAiRequest);

module.exports = router;