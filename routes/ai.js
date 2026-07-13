const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const rateLimit = require('express-rate-limit');

// Initialize Groq client
// Assumes GROQ_API_KEY is present in the environment
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key_if_not_set',
});

// Implement rate limiting to control API costs
const aiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 AI generation requests per windowMs
    message: { error: 'Too many AI requests created from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * @swagger
 * /api/ai/generate:
 *   post:
 *     summary: Generate content suggestions using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *               - type
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The user prompt or topic
 *               type:
 *                 type: string
 *                 enum: [caption, script, idea]
 *                 description: The type of content to generate
 *     responses:
 *       200:
 *         description: Successfully generated content
 *       400:
 *         description: Missing parameters
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/generate', aiRateLimiter, async (req, res) => {
    try {
        const { prompt, type } = req.body;

        if (!prompt || !type) {
            return res.status(400).json({ error: 'Prompt and type are required' });
        }

        let systemMessage = 'You are a helpful creative assistant for social media creators.';
        let maxTokens = 150; // Default token limit

        // Customize system message based on content type
        switch(type) {
            case 'caption':
                systemMessage = 'You are an expert social media manager. Generate a catchy, engaging caption for an Instagram/TikTok post based on the given topic. Include relevant hashtags at the end.';
                maxTokens = 200;
                break;
            case 'script':
                systemMessage = 'You are an expert video scriptwriter. Create a short, engaging 30-second to 60-second video script based on the given topic. Use a hook, body, and strong call to action.';
                maxTokens = 500;
                break;
            case 'idea':
                systemMessage = 'You are a creative director. Generate 3 unique, viral-worthy content ideas for a creator based on the given topic. Keep them brief and actionable.';
                maxTokens = 300;
                break;
            default:
                systemMessage = 'You are a helpful creative assistant. Provide relevant content based on the user request.';
                maxTokens = 200;
        }

        if (!process.env.GROQ_API_KEY) {
            // Mock response if key is not set to prevent crashing local dev without key
            return res.status(200).json({
                result: `[MOCK GENERATED CONTENT for "${prompt}" of type "${type}"]\n\nEnsure GROQ_API_KEY is set in .env to use real AI generation.`
            });
        }

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
            ],
            model: 'llama3-8b-8192', // Fast and free-tier friendly model on Groq
            max_tokens: maxTokens,
            temperature: 0.7,
        });

        const generatedText = chatCompletion.choices[0]?.message?.content || '';

        res.status(200).json({ result: generatedText });

    } catch (error) {
        console.error('AI Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate content', details: error.message });
    }
});

module.exports = router;
