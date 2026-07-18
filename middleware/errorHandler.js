const { wantsHtml } = require('../utils/requestType');

function getSafeErrorMessage(err, isProduction) {
  if (!err) return isProduction ? 'An internal error occurred.' : 'Unknown error';

  const isClientError = err.status && err.status >= 400 && err.status < 500;
  if (!isClientError && isProduction) {
    return 'An internal error occurred.';
  }

  const message = err.message || (isClientError ? 'Bad Request' : 'Internal server error');
  if (isProduction && isClientError) {
    return sanitizeClientErrorMessage(message);
  }

  return message;
}

function sanitizeClientErrorMessage(message) {
  if (!message || typeof message !== 'string') return 'Bad Request';

  const safePatterns = [
    'validation',
    'not found',
    'unauthorized',
    'forbidden',
    'bad request',
    'conflict',
    'duplicate',
    'required',
    'invalid',
  ];

  const lowerMessage = message.toLowerCase();
  const isSafeMessage = safePatterns.some(pattern => lowerMessage.includes(pattern));

  return isSafeMessage ? message : 'Bad Request';
}

function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';

  console.error('[ERROR]', {
    status: err.status || 500,
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  if (res.headersSent) return next(err);

  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const message = getSafeErrorMessage(err, isProduction);

  if (wantsHtml(req)) {
    return res.status(status).render('error', {
      error: message
    });
  }

  res.status(status).json({ success: false, message, error: message });
}

module.exports = errorHandler;
