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
  body('guestName')
    .trim()
    .notEmpty()
    .withMessage('Guest name is required')
    .isLength({ max: 100 })
    .withMessage('Guest name cannot exceed 100 characters')
    .escape(),
  body('guestEmail')
    .trim()
    .notEmpty()
    .withMessage('Guest email is required')
    .isEmail()
    .withMessage('A valid guest email address is required')
    .normalizeEmail(),
  body('guestNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Guest notes cannot exceed 1000 characters')
    .escape(),
  body('slotTime')
    .trim()
    .notEmpty()
    .withMessage('Slot time is required')
    .isISO8601()
    .withMessage('Slot time must be a valid ISO 8601 date string'),
]);

module.exports = {
  validateEventType,
  validateCreateBooking,
};
