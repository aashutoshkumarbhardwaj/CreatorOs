/**
 * @function asyncHandler
 * @description Wraps an async Express route handler so rejections are forwarded to `next`.
 * @param {Function} fn - Async `(req, res, next) => ...` handler
 * @returns {Function} Express middleware that catches promise rejections
 */
const asyncHandler = fn => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;