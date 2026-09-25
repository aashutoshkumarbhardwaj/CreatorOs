const { validationResult } = require('express-validator');
const { wantsHtml } = require('../../utils/requestType');

/**
 * Executes an array of express-validator chains and checks validation results.
 * If errors are found, formats response as HTML or JSON 422 appropriately.
 */
function validateRequest(validations, viewName = null, buildLocals = () => ({})) {
  const chains = Array.isArray(validations) ? validations : [validations];

  return async (req, res, next) => {
    for (const validation of chains) {
      if (typeof validation.run === 'function') {
        await validation.run(req);
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorArray = errors.array();
      const firstMsg = errorArray[0]?.msg || 'Invalid request data';

      if (wantsHtml(req) && viewName) {
        return res.status(400).render(viewName, {
          ...buildLocals(req),
          error: firstMsg,
          errors: errorArray,
        });
      }

      return res.status(422).json({
        success: false,
        message: firstMsg,
        errors: errorArray.map((err) => ({
          field: err.path || err.param,
          message: err.msg,
          value: err.value,
        })),
      });
    }

    next();
  };
}

/**
 * Middleware to sanitize query parameters from potential NoSQL injection objects.
 */
function sanitizeNoSqlQuery(queryKeys = ['q', 'stage', 'category', 'status', 'type', 'platform', 'priority', 'search', 'folderId', 'tag', 'isArchived', 'page', 'limit']) {
  return (req, res, next) => {
    if (req.query && typeof req.query === 'object') {
      // In Express 5, req.query is a getter that computes the query every time it's accessed.
      // We must cache the object, modify it, and overwrite the getter.
      const sanitizedQuery = { ...req.query };
      let modified = false;

      for (const key of queryKeys) {
        if (sanitizedQuery[key] !== undefined) {
          if (typeof sanitizedQuery[key] === 'object' && sanitizedQuery[key] !== null) {
            delete sanitizedQuery[key];
            modified = true;
          } else {
            sanitizedQuery[key] = String(sanitizedQuery[key]).trim();
            modified = true;
          }
        }
      }

      if (modified) {
        Object.defineProperty(req, 'query', {
          value: sanitizedQuery,
          configurable: true,
          enumerable: true
        });
      }
    }
    next();
  };
}

module.exports = {
  validateRequest,
  sanitizeNoSqlQuery,
};
