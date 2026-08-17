const { body } = require('express-validator');
const { validateRequest } = require('./common');

const validateBioLink = validateRequest([
  body('url')
    .trim()
    .notEmpty()
    .withMessage('URL is required')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('A valid http/https URL is required'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters')
    .escape(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .escape(),
]);

const validateProfile = validateRequest([
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters')
    .escape(),
  body('alias')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Alias can only contain letters, numbers, hyphens, and underscores')
    .isLength({ max: 50 })
    .withMessage('Alias cannot exceed 50 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters')
    .escape(),
]);

module.exports = {
  validateBioLink,
  validateProfile,
};
