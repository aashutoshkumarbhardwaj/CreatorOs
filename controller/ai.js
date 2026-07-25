const asyncHandler = require("../utils/asyncHandler");
// We mock OpenAI by default unless OPENAI_API_KEY is present
let openai;
const { OpenAI } = require("openai");
const MAX_AI_PROMPT_LENGTH = 500;

if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
    console.warn("⚠️ OPENAI_API_KEY is not configured. AI features will be disabled.");
}

// POST /api/ai/generate
const handleAiRequest = asyncHandler(async (req, res) => {
    const { prompt } = req.body;
    const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";
    
    if (!normalizedPrompt) {
        return res.status(400).json({ success: false, message: "Prompt is required" });
    }

    if (normalizedPrompt.length > MAX_AI_PROMPT_LENGTH) {
        return res.status(400).json({ success: false, message: `Prompt must be ${MAX_AI_PROMPT_LENGTH} characters or fewer` });
    }

    if (openai) { // Real API call
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: `Generate content suggestions for a creator based on: ${normalizedPrompt}` }],
                max_tokens: 150
            });
            return res.json({ success: true, data: response.choices[0].message.content });
        } catch (error) {
            console.error("OpenAI API error:", error);
            return res.status(502).json({ success: false, message: "AI generation failed" });
        }
    } else { 
        if (process.env.NODE_ENV === "production") {
            return res.status(503).json({ success: false, message: "AI service is not configured." });
        } else {
            console.log("[AI Controller] OpenAI key not found. Returning mock data.");
            const mockSuggestions = [
                `Top 5 ways to leverage ${normalizedPrompt} for audience growth.`,
                `Behind the scenes: How I use ${normalizedPrompt} every day.`,
                `The ultimate guide to ${normalizedPrompt} in 2026.`,
                `Why ${normalizedPrompt} is changing the creator economy.`
            ];
            return res.json({ success: true, data: mockSuggestions.join("\n") });
        }
    }
});

module.exports = {
    handleAiRequest,
    MAX_AI_PROMPT_LENGTH
};
