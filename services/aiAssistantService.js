const { OpenAI } = require("openai");

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "can't", "cannot",
  "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has",
  "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
  "is", "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on",
  "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so",
  "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what", "when",
  "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your", "yours", "yourself", "yourselves"
]);

let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Privacy & Security helper: Sanitizes sensitive PII, credentials, API keys from user prompts.
 * @param {string} text
 * @returns {string}
 */
function sanitizePrompt(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/(sk-[a-zA-Z0-9]{32,})/g, "[REDACTED_API_KEY]")
    .replace(/(Bearer\s+[a-zA-Z0-9\._\-]+)/gi, "[REDACTED_TOKEN]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, "[REDACTED_CARD]")
    .trim();
}

/**
 * Lightweight keyword extraction algorithm.
 * @param {string} text
 * @param {number} count
 * @returns {string[]}
 */
function extractKeywords(text, count = 6) {
  if (!text || typeof text !== "string") return ["content", "creator", "strategy", "growth"];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length === 0) return ["content", "creator", "strategy", "growth"];

  const freqMap = {};
  const posMap = {};
  words.forEach((w, idx) => {
    freqMap[w] = (freqMap[w] || 0) + 1;
    if (!(w in posMap)) posMap[w] = idx;
  });

  const scored = Object.keys(freqMap).map((w) => {
    const score = freqMap[w] * (1 / (1 + posMap[w] * 0.1)) * (w.length > 5 ? 1.2 : 1.0);
    return { word: w, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((item) => item.word);
}

/**
 * Categorizes hashtags into Viral, Niche, and Micro bundles.
 * @param {string} topic
 * @param {string} platform
 * @returns {{ viral: string[], niche: string[], micro: string[] }}
 */
function generateHashtagMatrix(topic, platform = "instagram") {
  const keywords = extractKeywords(topic, 5);
  const mainTag = keywords[0] || "content";

  const viral = [
    `#${mainTag}`,
    `#${platform}creator`,
    `#viral`,
    `#trending`,
    `#creatoros`
  ];

  const niche = keywords.slice(1, 4).map((k) => `#${k}tips`)
    .concat([`#${mainTag}community`, `#${mainTag}strategy`]);

  const micro = keywords.slice(0, 3).map((k) => `#${k}daily`)
    .concat([`#${mainTag}hacks`, `#learn${mainTag}`]);

  return { viral, niche, micro };
}

/**
 * Real-time SEO Discoverability Analyzer
 * @param {string} text
 * @param {string} platform
 * @returns {object}
 */
function analyzeContentSeo(text, platform = "general") {
  const sanitized = sanitizePrompt(text);
  const keywords = extractKeywords(sanitized, 6);
  const charCount = sanitized.length;
  const wordCount = sanitized.split(/\s+/).filter(Boolean).length;

  let seoScore = 50;

  // Length scoring
  if (wordCount >= 15 && wordCount <= 150) seoScore += 20;
  else if (wordCount > 150) seoScore += 10;

  // Question / Hook detection
  if (/[?!]/.test(sanitized)) seoScore += 10;

  // Keyword presence
  if (keywords.length >= 3) seoScore += 10;

  // Emojis / formatting check
  if (/[\u{1F300}-\u{1F9FF}]/u.test(sanitized)) seoScore += 10;

  seoScore = Math.min(98, Math.max(25, seoScore));

  const titleSuggestions = [
    `How to Master ${keywords[0] || "Content"} in 2026`,
    `5 Game-Changing Secrets About ${keywords[0] || "Strategy"}`,
    `The Ultimate ${platform.toUpperCase()} Guide to ${keywords[1] || "Growth"}`
  ];

  const metaDescription = sanitized.slice(0, 150) + (sanitized.length > 150 ? "..." : "");

  const optimizationTips = [];
  if (wordCount < 15) optimizationTips.push("Add more detailed descriptions to improve search indexability.");
  if (!sanitized.includes("?")) optimizationTips.push("Include an engaging question to increase click-through rate.");
  if (keywords.length < 3) optimizationTips.push("Incorporate more industry-specific target keywords.");

  return {
    seoScore,
    keywords,
    titleSuggestions,
    metaDescription,
    optimizationTips: optimizationTips.length > 0 ? optimizationTips : ["Great SEO formatting! Keep up the keyword alignment."]
  };
}

/**
 * Algorithmic Content Performance Predictor
 * @param {string} text
 * @param {string} platform
 * @returns {object}
 */
function predictContentPerformance(text, platform = "instagram") {
  const sanitized = sanitizePrompt(text);
  const words = sanitized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let viralityScore = 60;
  if (/[🔥⚡🚀💥✨🎯]/.test(sanitized)) viralityScore += 10;
  if (/\b(secret|ultimate|how to|top \d|stop|never|why)\b/i.test(sanitized)) viralityScore += 15;
  if (sanitized.includes("?")) viralityScore += 10;
  viralityScore = Math.min(99, Math.max(30, viralityScore));

  let readabilityGrade = "A";
  if (wordCount > 100) readabilityGrade = "B+";
  if (wordCount > 250) readabilityGrade = "C+";

  let engagementLevel = "High Potential";
  if (viralityScore >= 85) engagementLevel = "Viral Candidate 🚀";
  else if (viralityScore < 50) engagementLevel = "Moderate";

  const postingTimes = {
    instagram: "6:00 PM - 9:00 PM EST (Peak engagement window)",
    youtube: "2:00 PM - 4:00 PM EST (Pre-evening viewing peak)",
    twitter: "8:00 AM - 10:00 AM EST (Morning commute surge)",
    linkedin: "7:30 AM - 9:30 AM EST (Professional work hours)",
    tiktok: "7:00 PM - 11:00 PM EST (Late night discovery phase)",
    general: "5:00 PM - 8:00 PM local time"
  };

  return {
    viralityScore,
    readabilityGrade,
    engagementLevel,
    recommendedPostingTime: postingTimes[platform] || postingTimes.general,
    estimatedReachBand: viralityScore > 80 ? "10,000 - 50,000 Impressions" : "2,000 - 8,000 Impressions"
  };
}

/**
 * Local AI Fallback Engine
 * Generates rich responses, suggestions, hashtags, and performance metrics without OpenAI API key.
 * @param {object} params
 * @returns {object}
 */
function generateLocalAiResponse({ prompt, platform = "general", tone = "energetic" }) {
  const sanitized = sanitizePrompt(prompt);
  const keywords = extractKeywords(sanitized);
  const mainWord = keywords[0] || "content";
  const hashtags = generateHashtagMatrix(sanitized, platform);
  const seo = analyzeContentSeo(sanitized, platform);
  const performance = predictContentPerformance(sanitized, platform);

  const emoji = tone === "professional" ? "💼" : tone === "witty" ? "😏" : "🚀";

  const suggestions = [
    `${emoji} **Hook Idea**: 3 Proven strategies to double your ${mainWord} reach on ${platform.toUpperCase()}.`,
    `${emoji} **Content Angle**: Behind the scenes of building a high-impact ${mainWord} strategy.`,
    `${emoji} **Actionable Tip**: Stop making this common mistake with ${mainWord} creation.`,
    `${emoji} **Call to Action**: Save this post and tag a fellow creator who needs to hear this!`
  ];

  const content = `Here are intelligent AI suggestions tailored for **${platform.toUpperCase()}** in an **${tone.toUpperCase()}** tone:

### 💡 Content Angles & Copy Hooks
1. **The Hook**: "If you're still struggling with ${mainWord}, here is the exact framework to fix it in 2026."
2. **The Story**: "How I transformed my ${mainWord} workflow using CreatorOS automated tools."
3. **The Framework**: "Step-by-step roadmap to scale your audience with high-retention posts."

---

### 🔍 SEO & Discoverability Radar
- **Discoverability Score**: **${seo.seoScore}/100**
- **Target Keywords**: \`${keywords.join("`, `")}\`
- **Recommended Title**: "${seo.titleSuggestions[0]}"

---

### 📈 Performance Prediction
- **Virality Potential**: **${performance.viralityScore}%** (${performance.engagementLevel})
- **Optimal Posting Time**: ${performance.recommendedPostingTime}
- **Readability Grade**: ${performance.readabilityGrade}`;

  return {
    content,
    suggestions,
    seoScore: seo.seoScore,
    viralityScore: performance.viralityScore,
    keywords,
    hashtags: hashtags.viral.concat(hashtags.niche.slice(0, 3)),
    ctas: [
      `Save this post for later! 📌`,
      `Drop a comment below 👇`,
      `Share this with a creator friend! 🚀`
    ],
    source: "local_nlp"
  };
}

/**
 * Main AI Assistant Handler
 * Uses OpenAI Chat Completion if OPENAI_API_KEY is configured, else falls back to Local Intelligent NLP.
 * @param {object} options
 * @returns {Promise<object>}
 */
async function generateConversationalResponse({ prompt, platform = "general", tone = "energetic", history = [] }) {
  const sanitizedPrompt = sanitizePrompt(prompt);

  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const messages = [
        {
          role: "system",
          content: `You are CreatorOS AI Creator Assistant — an expert content strategist, copywriter, and growth advisor. 
Platform: ${platform}. Desired Tone: ${tone}.
Provide clear, actionable, structured advice. Include post hooks, copy recommendations, SEO advice, and call-to-actions.`
        }
      ];

      // Append up to last 4 conversation history messages
      if (Array.isArray(history)) {
        history.slice(-4).forEach((h) => {
          if (h.role && h.content) {
            messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: sanitizePrompt(h.content) });
          }
        });
      }

      messages.push({ role: "user", content: sanitizedPrompt });

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages,
        max_tokens: 600,
        temperature: 0.7,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      const seo = analyzeContentSeo(responseText, platform);
      const performance = predictContentPerformance(responseText, platform);
      const hashtags = generateHashtagMatrix(responseText, platform);

      return {
        content: responseText,
        suggestions: [
          `Hook option 1: Master ${platform} with ${tone} content.`,
          `Hook option 2: Why ${platform} creators fail without a strategy.`
        ],
        seoScore: seo.seoScore,
        viralityScore: performance.viralityScore,
        keywords: seo.keywords,
        hashtags: hashtags.viral.concat(hashtags.niche.slice(0, 3)),
        ctas: ["Save for later! 📌", "Drop your thoughts below 👇"],
        source: "openai"
      };
    } catch (err) {
      console.error("OpenAI API call failed, using local NLP fallback:", err.message);
      return generateLocalAiResponse({ prompt: sanitizedPrompt, platform, tone });
    }
  }

  return generateLocalAiResponse({ prompt: sanitizedPrompt, platform, tone });
}

/**
 * Generates 3 personalized growth insights for a creator.
 * @param {object} params
 * @returns {object[]}
 */
function generateCreatorInsights({ niche = "Digital Creator", totalPosts = 0 }) {
  return [
    {
      category: "content",
      tip: `Post consistency is your superpower. Publish at least 3 high-value ${niche} posts weekly to stay favored by platform algorithms.`,
      impactScore: 92,
      actionItem: "Schedule your next 3 posts in Content OS."
    },
    {
      category: "seo",
      tip: "Optimize post captions with niche-specific long-tail keywords rather than generic high-competition hashtags.",
      impactScore: 88,
      actionItem: "Run your next caption through the AI SEO Radar."
    },
    {
      category: "engagement",
      tip: "Engage with comments within the first 30 minutes of publishing to boost initial velocity and reach.",
      impactScore: 95,
      actionItem: "Turn on notifications for high-priority audience comments."
    }
  ];
}

module.exports = {
  sanitizePrompt,
  extractKeywords,
  generateHashtagMatrix,
  analyzeContentSeo,
  predictContentPerformance,
  generateConversationalResponse,
  generateCreatorInsights,
};
