const securityAuditService = require('../services/securityAuditService');

/**
 * Declarative Express middleware to audit security-critical endpoints
 * @param {string} category - Audit category (e.g., AUTH, ACCESS_CONTROL, ADMIN_MUTATION)
 * @param {string} action - Action descriptor (e.g., 'API_KEY_REVOKE', 'USER_ROLE_UPDATE')
 * @param {string} severity - Severity level ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
 * @param {Function} [resourceExtractor] - Optional callback (req) => ({ resourceType, resourceId })
 */
function auditAction(category, action, severity = 'INFO', resourceExtractor = null) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const targetResource = resourceExtractor
      ? resourceExtractor(req)
      : {
          resourceType: req.baseUrl || req.path,
          resourceId: req.params.id || req.body?.id || null
        };

    const recordAudit = (statusCode, responseBody) => {
      const isSuccess = statusCode >= 200 && statusCode < 400;
      const status = isSuccess ? 'SUCCESS' : statusCode === 403 ? 'DENIED' : 'FAILURE';

      const actor = {
        userId: req.user?.id || req.user?._id || 'anonymous',
        email: req.user?.email || 'anonymous@creatoros.app',
        role: req.user?.role || 'anonymous',
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.get('user-agent') || 'unknown'
      };

      const auditEvent = {
        category,
        action,
        severity: !isSuccess && severity === 'INFO' ? 'MEDIUM' : severity,
        actor,
        targetResource,
        status,
        metadata: {
          method: req.method,
          url: req.originalUrl,
          statusCode,
          query: req.query
        }
      };

      // Asynchronous non-blocking audit logging
      setImmediate(() => {
        securityAuditService.recordEvent(auditEvent).catch((err) => {
          console.error('[SecurityAuditMiddleware] Failed to record event:', err.message);
        });
      });
    };

    res.json = function (body) {
      recordAudit(res.statusCode, body);
      return originalJson(body);
    };

    res.send = function (body) {
      recordAudit(res.statusCode, body);
      return originalSend(body);
    };

    next();
  };
}

module.exports = {
  auditAction
};
