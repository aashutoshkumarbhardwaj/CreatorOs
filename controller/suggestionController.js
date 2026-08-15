const services = require('../services.config');
const asyncHandler = require('../utils/asyncHandler');
const { wantsHtml } = require('../utils/requestType');
const { suggestionSchema } = require('../middleware/validators');

const OPENAI_TIMEOUT_MS = 20000;
const TEMPLATE_MODE_FLAG = 'SUGGESTIONS_TEMPLATE_MODE';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so',
  'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Lightweight YAKE/KeyBERT inspired keyword extraction algorithm.
 * Removes stopwords and scores terms by frequency, position, and word length.
 * @param {string} text
 * @param {number} count
 * @returns {string[]}
 */
function extractKeywords(text, count = 6) {
  if (!text || typeof text !== 'string') return ['content', 'strategy', 'creator', 'trending'];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length === 0) return ['content', 'strategy', 'creator', 'trending'];

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

function getDefaultCtas(platform) {
  const ctasByPlatform = {
    instagram: [
      'Save this post for later! 📌',
      'Drop a comment below 👇',
      'Link in bio for full details 🔗',
      'Share this with a friend who needs it! 🚀'
    ],
    linkedin: [
      'What are your thoughts on this? Let\'s connect in the comments. 🤝',
      'Repost to share with your professional network 🔁',
      'Follow for more insights on this topic 💡',
      'Share your experience below 👇'
    ],
    twitter: [
      'Retweet if you agree! 🔄',
      'Quote tweet with your thoughts 💬',
      'Bookmark this thread for later 🔖',
      'Follow for daily updates ⚡'
    ],
    threads: [
      'Reply below with your thoughts 💬',
      'Share your experience with us 👇',
      'Repost to your thread 🧵',
      'Follow for more daily content ✨'
    ],
    facebook: [
      'Share this post with someone who needs to see it! 📢',
      'Leave a comment and join the discussion 👇',
      'Tag a friend below 👥',
      'Like and follow our page for more updates 👍'
    ],
    youtube: [
      'Subscribe to the channel and turn on notifications! 🔔',
      'Drop your questions in the comments below 👇',
      'Check the description box for links and resources 📥',
      'Smash the like button if this was helpful! 👍'
    ],
    tiktok: [
      'Follow for part 2! 🎬',
      'Comment your favorite tip below 👇',
      'Save this video for later 📌',
      'Share with a friend 🚀'
    ]
  };
  return ctasByPlatform[platform] || ctasByPlatform.instagram;
}

function getDefaultEmojis(tone) {
  const emojiMap = {
    energetic: ['🔥', '⚡', '🚀', '💥', '✨'],
    professional: ['📊', '🎯', '💼', '💡', '📈'],
    witty: ['😏', '🧠', '💡', '🎭', '😜'],
    minimalist: ['▪️', '🌱', '☕', '💭', '▫️'],
    persuasive: ['🏆', '👉', '🔥', '💯', '🚀'],
    educational: ['📚', '🎓', '💡', '🔍', '📝']
  };
  return emojiMap[tone] || ['🔥', '✨', '💡', '🚀', '📌'];
}

/**
 * Typed error for AI suggestion provider failures.
 */
class SuggestionProviderError extends Error {
  constructor(message, { code, statusCode = 503, retryable = true } = {}) {
    super(message);
    this.name = 'SuggestionProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

function isTemplateModeEnabled() {
  return String(process.env[TEMPLATE_MODE_FLAG] || '').toLowerCase() === 'true';
}

function parseOptions(input) {
  if (typeof input === 'string') {
    return {
      topic: input,
      platform: 'instagram',
      tone: 'energetic',
      length: 'medium',
      language: 'english',
      includeEmojis: true,
      includeCta: true
    };
  }
  return {
    topic: input.topic || '',
    platform: input.platform || 'instagram',
    tone: input.tone || 'energetic',
    length: input.length || 'medium',
    language: input.language || 'english',
    includeEmojis: input.includeEmojis !== false,
    includeCta: input.includeCta !== false
  };
}

/**
 * Offline template captions/hashtags. Never invents song titles.
 * @param {string|object} input
 * @returns {{ captions: string[], hashtags: string[], keywords: string[], ctas: string[], emojis: string[], songs: [], source: 'template' }}
 */
function generateTemplateSuggestions(input) {
  const opts = parseOptions(input);
  const topic = opts.topic;
  const words = topic.split(' ').filter((w) => w.length > 2);
  const mainWord = words.length > 0 ? words[0].toLowerCase() : 'vibes';
  const capWord = mainWord.charAt(0).toUpperCase() + mainWord.slice(1);
  const keywords = extractKeywords(topic);
  const ctas = getDefaultCtas(opts.platform);
  const emojis = getDefaultEmojis(opts.tone);

  const emojiPrefix = opts.includeEmojis ? `${emojis[0]} ` : '';
  const ctaSuffix = opts.includeCta ? `\n\n${ctas[0]}` : '';

  const captions = [
    `${emojiPrefix}Embracing the ${mainWord} state of mind on ${opts.platform}.${ctaSuffix}`,
    `${emojiPrefix}Nothing beats great ${mainWord} and strategic consistency.${opts.includeCta ? `\n\n${ctas[1]}` : ''}`,
    `${emojiPrefix}${capWord} breakdown: Here's what you need to know today.${opts.includeCta ? `\n\n${ctas[2]}` : ''}`,
    `${emojiPrefix}Living for these ${mainWord} moments in our creator journey.${ctaSuffix}`,
    `${emojiPrefix}Just another day enjoying the power of ${mainWord}.${opts.includeCta ? `\n\n${ctas[3]}` : ''}`
  ];

  const hashtags = [
    `#${mainWord}`, `#${mainWord}vibes`, `#${mainWord}life`,
    `#${opts.platform}creator`, `#explore`, `#trending`,
    `#${mainWord}goals`, `#seo`, `#creatoros`
  ];

  return {
    captions,
    hashtags,
    keywords,
    ctas,
    emojis,
    songs: [],
    source: 'template'
  };
}

function normalizeProviderPayload(parsed, opts = {}) {
  if (!parsed || typeof parsed !== 'object') {
    throw new SuggestionProviderError('AI returned an invalid response. Please try again.', {
      code: 'INVALID_RESPONSE'
    });
  }

  const captions = Array.isArray(parsed.captions) ? parsed.captions.filter((c) => typeof c === 'string') : [];
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h) => typeof h === 'string') : [];
  const songs = Array.isArray(parsed.songs)
    ? parsed.songs.filter((s) => s && typeof s.title === 'string')
    : [];

  if (captions.length === 0 || hashtags.length === 0) {
    throw new SuggestionProviderError('AI returned an incomplete response. Please try again.', {
      code: 'INVALID_RESPONSE'
    });
  }

  const keywords = Array.isArray(parsed.keywords) && parsed.keywords.length > 0
    ? parsed.keywords.filter((k) => typeof k === 'string')
    : extractKeywords(opts.topic || '');

  const ctas = Array.isArray(parsed.ctas) && parsed.ctas.length > 0
    ? parsed.ctas.filter((c) => typeof c === 'string')
    : getDefaultCtas(opts.platform || 'instagram');

  const emojis = Array.isArray(parsed.emojis) && parsed.emojis.length > 0
    ? parsed.emojis.filter((e) => typeof e === 'string')
    : getDefaultEmojis(opts.tone || 'energetic');

  return {
    captions,
    hashtags,
    keywords,
    ctas,
    emojis,
    songs,
    source: 'openai'
  };
}

/**
 * @function generateAISuggestions
 * @description Generates AI-powered content suggestions, or labelled templates when explicitly enabled.
 * @param {string|object} input
 * @returns {Promise<{captions: string[], hashtags: string[], keywords: string[], ctas: string[], emojis: string[], songs: Array, source: string}>}
 */
async function generateAISuggestions(input) {
  const opts = parseOptions(input);

  if (!process.env.OPENAI_API_KEY) {
    if (isTemplateModeEnabled()) {
      return generateTemplateSuggestions(opts);
    }
    throw new SuggestionProviderError(
      'AI suggestions are unavailable because no provider is configured. Set OPENAI_API_KEY or enable SUGGESTIONS_TEMPLATE_MODE.',
      { code: 'NOT_CONFIGURED', retryable: false }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              `You are an expert social media manager and AI copywriter. Generate tailored content for ${opts.platform} in ${opts.language} language. Tone: ${opts.tone}, Length: ${opts.length}. Include Emojis: ${opts.includeEmojis}, Include CTAs: ${opts.includeCta}. Return ONLY a raw JSON object with keys: "captions" (array of 5 strings), "hashtags" (array of 9 strings mixing niche & trending), "keywords" (array of 6 extracted SEO keywords), "ctas" (array of 4 CTA suggestions), "emojis" (array of 5 emojis), "songs" (array of objects with "title" and "mood").`
          },
          {
            role: 'user',
            content: `Topic / Details: ${opts.topic}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new SuggestionProviderError(
        'The AI provider is temporarily unavailable. Please try again.',
        { code: 'PROVIDER_ERROR' }
      );
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new SuggestionProviderError(
        'AI returned an invalid response. Please try again.',
        { code: 'INVALID_RESPONSE' }
      );
    }

    let rawContent = data.choices[0].message.content || '';
    rawContent = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseError) {
      throw new SuggestionProviderError(
        'AI returned unreadable content. Please try again.',
        { code: 'INVALID_RESPONSE' }
      );
    }

    return normalizeProviderPayload(parsed, opts);
  } catch (err) {
    if (err instanceof SuggestionProviderError) {
      if (isTemplateModeEnabled()) {
        console.error('AI generation failed; serving labelled template mode:', err.message);
        return generateTemplateSuggestions(opts);
      }
      throw err;
    }

    if (err && err.name === 'AbortError') {
      const timeoutError = new SuggestionProviderError(
        'AI suggestions timed out. Please try again.',
        { code: 'TIMEOUT' }
      );
      if (isTemplateModeEnabled()) {
        console.error('AI generation timed out; serving labelled template mode');
        return generateTemplateSuggestions(opts);
      }
      throw timeoutError;
    }

    console.error('AI Generation Failed:', err);
    const providerError = new SuggestionProviderError(
      'AI suggestions are temporarily unavailable. Please try again.',
      { code: 'PROVIDER_ERROR' }
    );
    if (isTemplateModeEnabled()) {
      return generateTemplateSuggestions(opts);
    }
    throw providerError;
  } finally {
    clearTimeout(timeoutId);
  }
}

function renderSuggestionsPage(res, status, locals) {
  return res.status(status).render('suggestions', {
    categories: [],
    services,
    ...locals
  });
}

function buildErrorLocals(topic, err, options = {}) {
  const isProviderError = err instanceof SuggestionProviderError;
  return {
    result: null,
    selected: topic || null,
    options: options,
    source: null,
    error: isProviderError
      ? err.message
      : 'An unexpected error occurred while generating suggestions.',
    errorCode: isProviderError ? err.code : 'UNEXPECTED',
    retryable: isProviderError ? err.retryable : true
  };
}

exports.getPage = (req, res) => {
  renderSuggestionsPage(res, 200, {
    result: null,
    selected: null,
    options: {
      platform: 'instagram',
      tone: 'energetic',
      length: 'medium',
      language: 'english',
      includeEmojis: true,
      includeCta: true
    },
    source: null,
    error: null,
    errorCode: null,
    retryable: false
  });
};

exports.getSuggestions = asyncHandler(async (req, res) => {
  const validationResult = suggestionSchema.safeParse(req.body);
  if (!validationResult.success) {
    const errorMsg = validationResult.error.errors[0]?.message || 'Invalid input provided.';
    if (!wantsHtml(req)) {
      return res.status(400).json({
        success: false,
        message: errorMsg,
        error: errorMsg,
        code: 'VALIDATION_ERROR',
        retryable: false
      });
    }
    return renderSuggestionsPage(res, 400, {
      result: null,
      selected: req.body?.topic || null,
      options: req.body || {},
      source: null,
      error: errorMsg,
      errorCode: 'VALIDATION_ERROR',
      retryable: false
    });
  }

  const options = validationResult.data;
  const { topic } = options;

  try {
    const result = await generateAISuggestions(options);

    if (!wantsHtml(req)) {
      return res.json({
        success: true,
        source: result.source,
        selected: topic,
        options: options,
        result: {
          captions: result.captions,
          hashtags: result.hashtags,
          keywords: result.keywords,
          ctas: result.ctas,
          emojis: result.emojis,
          songs: result.songs
        },
        isTemplate: result.source === 'template'
      });
    }

    return renderSuggestionsPage(res, 200, {
      result,
      selected: topic,
      options: options,
      source: result.source,
      error: null,
      errorCode: null,
      retryable: false
    });
  } catch (err) {
    console.error('Error generating suggestions:', err);
    const locals = buildErrorLocals(topic, err, options);
    const status = err instanceof SuggestionProviderError ? err.statusCode : 500;

    if (!wantsHtml(req)) {
      return res.status(status).json({
        success: false,
        message: locals.error,
        error: locals.error,
        code: locals.errorCode,
        retryable: locals.retryable,
        selected: topic,
        options: options
      });
    }

    return renderSuggestionsPage(res, status, locals);
  }
});

exports.generateAISuggestions = generateAISuggestions;
exports.generateTemplateSuggestions = generateTemplateSuggestions;
exports.extractKeywords = extractKeywords;
exports.SuggestionProviderError = SuggestionProviderError;
exports.TEMPLATE_MODE_FLAG = TEMPLATE_MODE_FLAG;
