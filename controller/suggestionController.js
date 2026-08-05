const services = require('../services.config');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @function generateAISuggestions
 * @description Generates AI-powered content suggestions for the user.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function generateAISuggestions(topic) {
  if (!process.env.OPENAI_API_KEY) {
    if (process.env.USE_TEMPLATE_FALLBACK === 'true') {
      return generateTemplateFallback(topic);
    }
    throw new Error('AI Provider is not configured.');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media manager. Generate exactly 5 captions, 9 hashtags, and 5 song recommendations (with title and mood) for the given topic. Return ONLY a raw JSON object with keys: "captions" (array of strings), "hashtags" (array of strings), "songs" (array of objects with "title" and "mood").'
          },
          {
            role: 'user',
            content: `Topic: ${topic}`
          }
        ]
      })
    });
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.choices && data.choices[0]) {
      let rawContent = data.choices[0].message.content;
      rawContent = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(rawContent);
    }
    throw new Error('AI Provider returned an invalid response format.');
  } catch (e) {
    if (process.env.USE_TEMPLATE_FALLBACK === 'true') {
        console.error('AI Generation Failed, falling back to mock generator:', e);
        return generateTemplateFallback(topic);
    }
    throw new Error(`AI Generation Failed: ${e.message}`);
  }
}

function generateTemplateFallback(topic) {
  const words = topic.split(' ').filter(w => w.length > 2);
  const mainWord = words.length > 0 ? words[0].toLowerCase() : 'vibes';
  const capWord = mainWord.charAt(0).toUpperCase() + mainWord.slice(1);

  return {
    isTemplateFallback: true,
    captions: [
      `Embracing the ${mainWord} today ✨`,
      `Nothing beats good ${mainWord} and great company 🥂`,
      `${capWord} state of mind 🧠`,
      `Living for these ${mainWord} moments 🌟`,
      `Just another day enjoying the ${mainWord} 📸`
    ],
    hashtags: [
      `#${mainWord}`, `#${mainWord}vibes`, `#${mainWord}life`,
      `#instadaily`, `#explore`, `#trending`,
      `#${mainWord}goals`, `#foryou`, `#creator`
    ],
    songs: [] // Omitted as per issue 881: no unverified music recommendations in template mode
  };
}

exports.getPage = (req, res) => {
  // We no longer need static categories
  res.render('suggestions', { categories: [], result: null, selected: null, error: null, services });
};

const { suggestionSchema } = require('../middleware/validators');

exports.getSuggestions = asyncHandler(async (req, res, next) => {
  const validationResult = suggestionSchema.safeParse(req.body);
  if (!validationResult.success) {
    const errorMsg = validationResult.error.errors[0]?.message || 'Invalid input provided.';
    return res.render('suggestions', { categories: [], result: null, selected: null, error: errorMsg, services });
  }

  const { topic } = validationResult.data;

  try {
    const result = await generateAISuggestions(topic);
    res.render('suggestions', { categories: [], result, selected: topic, error: null, services });
  } catch (err) {
    console.error('Error generating suggestions:', err);
    res.render('suggestions', { categories: [], result: null, selected: topic, error: 'An unexpected error occurred while generating suggestions.', services });
  }
});
