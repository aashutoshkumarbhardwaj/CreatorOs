const { body } = require('express-validator');
const { validateRequest } = require('./common');

const validateDmTrigger = validateRequest([
  body('keyword')
    .trim()
    .notEmpty()
    .withMessage('Keyword is required')
    .isLength({ max: 100 })
    .withMessage('Keyword cannot exceed 100 characters')
    .escape(),
  body('responseType')
    .optional()
    .trim()
    .isIn(['text', 'link', 'media'])
    .withMessage('Invalid response type'),
  body('responseText')
    .trim()
    .notEmpty()
    .withMessage('Response text is required')
    .isLength({ max: 1000 })
    .withMessage('Response text cannot exceed 1000 characters')
    .escape(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
]);

module.exports = {
  validateDmTrigger,
};
