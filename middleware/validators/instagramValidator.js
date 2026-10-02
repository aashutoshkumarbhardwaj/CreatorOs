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

  body('triggerSource')
    .optional()
    .trim()
    .isIn(['dm', 'comment'])
    .withMessage('triggerSource must be "dm" or "comment"'),

  body('postId')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage('postId must be a string')
    .isLength({ max: 100 })
    .withMessage('postId cannot exceed 100 characters'),

  body('matchType')
    .optional()
    .trim()
    .isIn(['partial', 'exact'])
    .withMessage('matchType must be "partial" or "exact"'),

  body('responseText')
    .trim()
    .notEmpty()
    .withMessage('responseText is required')
    .isLength({ max: 1000 })
    .withMessage('responseText cannot exceed 1000 characters')
    .escape(),

  body('commentReply')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('commentReply cannot exceed 500 characters')
    .escape(),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
]);

module.exports = {
  validateDmTrigger,
};
