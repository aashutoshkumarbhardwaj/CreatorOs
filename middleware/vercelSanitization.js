const mongoSanitize = require("express-mongo-sanitize");

/**
 * Fix for Vercel Serverless: req.query is a getter, so direct assignment throws TypeError.
 * This middleware sanitizes inputs to prevent NoSQL injection.
 */
const vercelSanitization = (req, res, next) => {
  ["body", "params", "headers", "query"].forEach((key) => {
    if (req[key]) {
      const sanitized = mongoSanitize.sanitize(req[key], { replaceWith: "_" });
      try {
        req[key] = sanitized;
      } catch (e) {
        // If assignment fails (e.g., getter-only on Vercel), use Object.defineProperty
        Object.defineProperty(req, key, {
          value: sanitized,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
  });
  next();
};

module.exports = vercelSanitization;
