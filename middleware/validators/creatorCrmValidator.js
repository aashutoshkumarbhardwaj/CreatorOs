const { body } = require('express-validator');
const { validateRequest, sanitizeNoSqlQuery } = require('./common');

const validateBrand = validateRequest([
  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 150 })
    .withMessage('Company name cannot exceed 150 characters')
    .escape(),
  body('contactEmail')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('A valid email address is required')
    .normalizeEmail(),
  body('contactPhone')
    .optional({ checkFalsy: true })
    .trim()
    .escape(),
  body('website')
    .optional({ checkFalsy: true })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Website must be a valid http or https URL'),
  body('status')
    .optional()
    .trim()
    .isIn(['lead', 'contacted', 'negotiating', 'partner', 'declined', 'all'])
    .withMessage('Invalid status value'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes cannot exceed 2000 characters')
    .escape(),
]);

const validateDeal = validateRequest([
  body('dealName')
    .trim()
    .notEmpty()
    .withMessage('Deal name is required')
    .isLength({ max: 200 })
    .withMessage('Deal name cannot exceed 200 characters')
    .escape(),
  body('companyName')
    .optional()
    .trim()
    .escape(),
  body('stage')
    .optional()
    .trim()
    .isIn(['lead', 'contacted', 'negotiating', 'contract_sent', 'signed', 'delivering', 'completed', 'paid', 'lost'])
    .withMessage('Invalid deal stage'),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a non-negative number'),
  body('category')
    .optional()
    .trim()
    .escape(),
  body('contactEmail')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Valid contact email is required'),
]);

const validateInvoice = validateRequest([
  body('invoiceName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .escape(),
  body('invoiceNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .escape(),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a non-negative number'),
  body('status')
    .optional()
    .trim()
    .isIn(['draft', 'sent', 'pending', 'paid', 'overdue', 'cancelled'])
    .withMessage('Invalid invoice status'),
  body('dueDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid due date format'),
]);

const validateMediaKit = validateRequest([
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .escape(),
]);

const validateCrmQuery = sanitizeNoSqlQuery(['q', 'stage', 'category', 'status']);

module.exports = {
  validateBrand,
  validateDeal,
  validateInvoice,
  validateMediaKit,
  validateCrmQuery,
};
