const { body } = require('express-validator');
const { validateRequest } = require('./common');

const validateContentItem = validateRequest([
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters')
    .escape(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters')
    .escape(),
  body('type')
    .optional()
    .trim()
    .isIn(['idea', 'script', 'post', 'template', 'draft'])
    .withMessage('Invalid content type'),
  body('status')
    .optional()
    .trim()
    .isIn(['idea', 'scripting', 'filming', 'editing', 'ready', 'scheduled', 'published'])
    .withMessage('Invalid status'),
  body('platform')
    .optional()
    .trim()
    .isIn(['instagram', 'youtube', 'twitter', 'tiktok', 'linkedin', 'blog', 'general'])
    .withMessage('Invalid platform'),
  body('priority')
    .optional()
    .trim()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
]);

const validateContentFolder = validateRequest([
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Folder name is required')
    .isLength({ max: 100 })
    .withMessage('Folder name cannot exceed 100 characters')
    .escape(),
  body('color')
    .optional()
    .trim()
    .matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .withMessage('Invalid hex color format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Folder description cannot exceed 500 characters')
    .escape(),
]);

const validateAiPrompt = validateRequest([
  body('prompt')
    .trim()
    .notEmpty()
    .withMessage('Prompt is required')
    .isLength({ max: 2000 })
    .withMessage('Prompt cannot exceed 2000 characters')
    .escape(),
  body('mode')
    .optional()
    .trim()
    .isIn(['idea', 'hook', 'script', 'caption'])
    .withMessage('Invalid AI mode'),
  body('platform')
    .optional()
    .trim()
    .isIn(['instagram', 'youtube', 'twitter', 'tiktok', 'linkedin', 'blog', 'general'])
    .withMessage('Invalid platform'),
]);

module.exports = {
  validateContentItem,
  validateContentFolder,
  validateAiPrompt,
};
