const { wantsHtml } = require('../utils/requestType');

/**
 * @function errorHandler
 * @description Automatically generated JSDoc for errorHandler
 * @returns {any}
 */
function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);

  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const isClientError = status >= 400 && status < 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isClientError
    ? (err.message || 'Bad Request')
    : (isProduction ? 'Internal server error' : (err.message || 'Internal server error'));

  if (wantsHtml(req)) {
    return res.status(status).render('error', {
      error: message
    });
  }

  res.status(status).json({ success: false, message, error: message });
}

module.exports = errorHandler;
