const asyncHandler = require("../utils/asyncHandler");
// We mock OpenAI by default unless OPENAI_API_KEY is present
let openai;
const { OpenAI } = require("openai");

if (process.env.NODE_ENV === "production" && !process.env.OPENAI_API_KEY) {
    // In production, a missing key is a fatal configuration error.
    throw new Error("FATAL: OPENAI_API_KEY is not configured for production environment.");
} else if (process.env.OPENAI_API_KEY) {
    // In development or if the key is present, initialize the client.
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// POST /api/ai/generate
const handleAiRequest = asyncHandler(async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ success: false, message: "Prompt is required" });
    }

    if (openai) { // Real API call
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: `Generate content suggestions for a creator based on: ${prompt}` }],
                max_tokens: 150
            });
            return res.json({ success: true, data: response.choices[0].message.content });
        } catch (error) {
            console.error("OpenAI API error:", error);
            return res.status(502).json({ success: false, message: "AI generation failed" });
        }
    } else { // Mock response for local development without an API key
        console.log("[AI Controller] OpenAI key not found. Returning mock data.");
        const mockSuggestions = [
            `Top 5 ways to leverage ${prompt} for audience growth.`,
            `Behind the scenes: How I use ${prompt} every day.`,
            `The ultimate guide to ${prompt} in 2026.`,
            `Why ${prompt} is changing the creator economy.`
        ];
        return res.json({ success: true, data: mockSuggestions.join("\n") });
    }
});

module.exports = {
    handleAiRequest
};
