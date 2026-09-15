const { body } = require('express-validator');
const { validateRequest } = require('./common');

const validatePreferences = validateRequest([
  body('frequency')
    .optional()
    .trim()
    .isIn(['instant', 'daily_digest', 'weekly_summary'])
    .withMessage('Invalid notification frequency setting'),
  body('channels.email')
    .optional()
    .isBoolean()
    .withMessage('Email channel setting must be a boolean'),
  body('channels.inApp')
    .optional()
    .isBoolean()
    .withMessage('In-App channel setting must be a boolean'),
  body('channels.push')
    .optional()
    .isBoolean()
    .withMessage('Push channel setting must be a boolean'),
  body('channels.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS channel setting must be a boolean'),
  body('categories')
    .optional()
    .isObject()
    .withMessage('Categories must be an object'),
  body('categories.*')
    .optional()
    .isBoolean()
    .withMessage('Category settings must be boolean values'),
  body('quietHours.enabled').optional().isBoolean(),
  body('quietHours.startTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('quietHours.endTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('quietHours.timezone').optional().isString().trim().notEmpty(),
  body('intelligentScheduling.enabled').optional().isBoolean(),
  body('intelligentScheduling.preferredWindow')
    .optional()
    .isIn(['optimal', 'morning', 'afternoon', 'evening']),
  body('deduplication.enabled').optional().isBoolean(),
  body('deduplication.windowMinutes').optional().isInt({ min: 1, max: 1440 }),
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
