const { body } = require('express-validator');
const { validateRequest } = require('./common');

const validateEventType = validateRequest([
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 150 })
    .withMessage('Title cannot exceed 150 characters')
    .escape(),
  body('slug')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[a-z0-9-]+$/i)
    .withMessage('Slug must contain only letters, numbers, and hyphens'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Duration must be between 1 and 1440 minutes'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters')
    .escape(),
]);

const validateCreateBooking = validateRequest([
  body('attendeeName')
    .trim()
    .notEmpty()
    .withMessage('Attendee name is required')
    .isLength({ max: 100 })
    .withMessage('Attendee name cannot exceed 100 characters')
    .escape(),
  body('attendeeEmail')
    .trim()
    .notEmpty()
    .withMessage('Attendee email is required')
    .isEmail()
    .withMessage('A valid attendee email address is required')
    .normalizeEmail(),
  body('attendeeNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Attendee notes cannot exceed 1000 characters')
    .escape(),
  body('startTime')
    .trim()
    .notEmpty()
    .withMessage('Start time is required')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date string'),
]);

module.exports = {
  validateEventType,
  validateCreateBooking,
};
