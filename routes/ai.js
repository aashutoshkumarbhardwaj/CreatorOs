const express = require("express");
const { generateSuggestion } = require("../controller/ai");
const { restrictToLoggedinUserOnly } = require("../middleware/auth");
const { aiGenerationLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

/**
 * @swagger
 * /api/ai/suggest:
 *   post:
 *     summary: Generate content suggestions
 *     description: Uses OpenAI API to generate content suggestions for creators based on a prompt.
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
 *     responses:
 *       200:
 *         description: Suggestions generated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 *       502:
 *         description: AI API failed
 */
router.post("/suggest", restrictToLoggedinUserOnly, aiGenerationLimiter, generateSuggestion);

module.exports = router;
