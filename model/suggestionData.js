const mongoose = require('mongoose');

/**
 * @schema suggestionSchema
 * @description Mongoose schema definition for suggestion.
 */
const suggestionSchema = new mongoose.Schema({
  category: { type: String, required: true },
  captions: [String],
  hashtags: [String],
  songs: [
    {
      title: String,
      mood: String
    }
  ]
});

module.exports =
  mongoose.models.Suggestion ||
  mongoose.model('Suggestion', suggestionSchema);
