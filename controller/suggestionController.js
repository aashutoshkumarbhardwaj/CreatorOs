const services = require('../services.config');
const asyncHandler = require('../utils/asyncHandler');
const { wantsHtml } = require('../utils/requestType');
const { suggestionSchema } = require('../middleware/validators');

const OPENAI_TIMEOUT_MS = 20000;
const TEMPLATE_MODE_FLAG = 'SUGGESTIONS_TEMPLATE_MODE';

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

/**
 * Offline template captions/hashtags. Never invents song titles.
 * @param {string} topic
 * @returns {{ captions: string[], hashtags: string[], songs: [], source: 'template' }}
 */
function generateTemplateSuggestions(topic) {
  const words = topic.split(' ').filter((w) => w.length > 2);
  const mainWord = words.length > 0 ? words[0].toLowerCase() : 'vibes';
  const capWord = mainWord.charAt(0).toUpperCase() + mainWord.slice(1);

  return {
    captions: [
      `Embracing the ${mainWord} today`,
      `Nothing beats good ${mainWord} and great company`,
      `${capWord} state of mind`,
      `Living for these ${mainWord} moments`,
      `Just another day enjoying the ${mainWord}`
    ],
    hashtags: [
      `#${mainWord}`, `#${mainWord}vibes`, `#${mainWord}life`,
      `#instadaily`, `#explore`, `#trending`,
      `#${mainWord}goals`, `#foryou`, `#creator`
    ],
    songs: [],
    source: 'template'
  };
}

function normalizeProviderPayload(parsed) {
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

  return {
    captions,
    hashtags,
    songs,
    source: 'openai'
  };
}

/**
 * @function generateAISuggestions
 * @description Generates AI-powered content suggestions, or labelled templates when explicitly enabled.
 * @param {string} topic
 * @returns {Promise<{captions: string[], hashtags: string[], songs: Array, source: string}>}
 */
async function generateAISuggestions(topic) {
  if (!process.env.OPENAI_API_KEY) {
    if (isTemplateModeEnabled()) {
      return generateTemplateSuggestions(topic);
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
              'You are an expert social media manager. Generate exactly 5 captions, 9 hashtags, and 5 song recommendations (with title and mood) for the given topic. Return ONLY a raw JSON object with keys: "captions" (array of strings), "hashtags" (array of strings), "songs" (array of objects with "title" and "mood").'
          },
          {
            role: 'user',
            content: `Topic: ${topic}`
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

    return normalizeProviderPayload(parsed);
  } catch (err) {
    if (err instanceof SuggestionProviderError) {
      if (isTemplateModeEnabled()) {
        console.error('AI generation failed; serving labelled template mode:', err.message);
        return generateTemplateSuggestions(topic);
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
        return generateTemplateSuggestions(topic);
      }
      throw timeoutError;
    }

    console.error('AI Generation Failed:', err);
    const providerError = new SuggestionProviderError(
      'AI suggestions are temporarily unavailable. Please try again.',
      { code: 'PROVIDER_ERROR' }
    );
    if (isTemplateModeEnabled()) {
      return generateTemplateSuggestions(topic);
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

function buildErrorLocals(topic, err) {
  const isProviderError = err instanceof SuggestionProviderError;
  return {
    result: null,
    selected: topic || null,
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
      selected: null,
      source: null,
      error: errorMsg,
      errorCode: 'VALIDATION_ERROR',
      retryable: false
    });
  }

  const { topic } = validationResult.data;

  try {
    const result = await generateAISuggestions(topic);

    if (!wantsHtml(req)) {
      return res.json({
        success: true,
        source: result.source,
        selected: topic,
        result: {
          captions: result.captions,
          hashtags: result.hashtags,
          songs: result.songs
        },
        isTemplate: result.source === 'template'
      });
    }

    return renderSuggestionsPage(res, 200, {
      result,
      selected: topic,
      source: result.source,
      error: null,
      errorCode: null,
      retryable: false
    });
  } catch (err) {
    console.error('Error generating suggestions:', err);
    const locals = buildErrorLocals(topic, err);
    const status = err instanceof SuggestionProviderError ? err.statusCode : 500;

    if (!wantsHtml(req)) {
      return res.status(status).json({
        success: false,
        message: locals.error,
        error: locals.error,
        code: locals.errorCode,
        retryable: locals.retryable,
        selected: topic
      });
    }

    return renderSuggestionsPage(res, status, locals);
  }
});

exports.generateAISuggestions = generateAISuggestions;
exports.generateTemplateSuggestions = generateTemplateSuggestions;
exports.SuggestionProviderError = SuggestionProviderError;
exports.TEMPLATE_MODE_FLAG = TEMPLATE_MODE_FLAG;
