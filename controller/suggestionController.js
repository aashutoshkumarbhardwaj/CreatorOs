const services = require('../services.config');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @function generateAISuggestions
 * @description Automatically generated JSDoc for generateAISuggestions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function generateAISuggestions(topic) {
  // If OpenAI API key is configured, use it for real AI generation
  if (process.env.OPENAI_API_KEY) {
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
      const data = await response.json();
      if (data.choices && data.choices[0]) {
        return JSON.parse(data.choices[0].message.content);
      }
    } catch (e) {
      console.error('AI Generation Failed, falling back to mock generator:', e);
    }
  }

  // Fallback: Dynamic mock generator based on the topic
  const words = topic.split(' ').filter(w => w.length > 2);
  const mainWord = words.length > 0 ? words[0].toLowerCase() : 'vibes';
  const capWord = mainWord.charAt(0).toUpperCase() + mainWord.slice(1);

  return {
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
    songs: [
      { title: `${capWord} Dreams - The Creator`, mood: 'chill' },
      { title: `Summer ${capWord} - DJ Mix`, mood: 'upbeat' },
      { title: `Midnight ${capWord} - Lofi Boy`, mood: 'focus' },
      { title: `Golden ${capWord} - Sunset Bros`, mood: 'cinematic' },
      { title: `Pure ${capWord} - Acoustic`, mood: 'relaxing' }
    ]
  };
}

exports.getPage = (req, res) => {
  // We no longer need static categories
  res.render('suggestions', { categories: [], result: null, selected: null, services });
};

exports.getSuggestions = async (req, res) => {
  const { topic } = req.body;
  if (!topic) {
    return res.render('suggestions', { categories: [], result: null, selected: null, services });
  }

  const result = await generateAISuggestions(topic);
  
  res.render('suggestions', { categories: [], result, selected: topic, services });
};
