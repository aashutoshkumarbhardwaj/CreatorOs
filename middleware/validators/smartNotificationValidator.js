const { body } = require('express-validator');
const { validateRequest } = require('./common');

const validatePreferences = validateRequest([
  body('channels.email')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('Email channel setting must be a boolean'),
  body('channels.inApp')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('In-App channel setting must be a boolean'),
  body('channels.push')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('Push channel setting must be a boolean'),
  body('channels.sms')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('SMS channel setting must be a boolean'),
  body('categories')
    .optional()
    .isObject()
    .withMessage('Categories must be an object'),
  body('categories.system')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('Category setting must be a boolean'),
  body('categories.engagement')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('Category setting must be a boolean'),
  body('categories.content')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('Category setting must be a boolean'),
  body('categories.analytics')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('Category setting must be a boolean'),
  body('categories.marketing')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('Category setting must be a boolean'),
  body('quietHours.enabled')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('quietHours.enabled must be a boolean'),
  body('quietHours.startTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('quietHours.startTime must use HH:mm format'),
  body('quietHours.endTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('quietHours.endTime must use HH:mm format'),
  body('quietHours.timezone').optional().isString().trim().notEmpty().withMessage('quietHours.timezone is required'),
  body('intelligentScheduling.enabled')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('intelligentScheduling.enabled must be a boolean'),
  body('intelligentScheduling.preferredWindow')
    .optional()
    .isIn(['optimal', 'morning', 'afternoon', 'evening'])
    .withMessage('Invalid preferred window'),
  body('deduplication.enabled')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('deduplication.enabled must be a boolean'),
  body('deduplication.windowMinutes')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('deduplication.windowMinutes must be between 1 and 1440'),
]);

const validateCreateNotification = validateRequest([
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 150 })
    .withMessage('Title cannot exceed 150 characters')
    .escape(),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters')
    .escape(),
  body('type')
    .optional()
    .trim()
    .escape(),
  body('priority')
    .optional()
    .trim()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),
  body('actionUrl')
    .optional({ checkFalsy: true })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Action URL must be a valid http or https URL'),
]);

module.exports = {
  validatePreferences,
  validateCreateNotification,
};
