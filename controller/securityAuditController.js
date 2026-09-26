const securityAuditService = require('../services/securityAuditService');

/**
 * Controller for Security Audit & SIEM Compliance APIs
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      severity: req.query.severity,
      action: req.query.action,
      userId: req.query.userId,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const pagination = {
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await securityAuditService.queryLogs(filters, pagination);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.exportSIEM = async (req, res) => {
  try {
    const format = (req.query.format || 'cef').toLowerCase();
    const result = await securityAuditService.queryLogs({}, { limit: 500 });
    const events = result.logs || [];

    if (format === 'cef') {
      const cefOutput = securityAuditService.exportToCEF(events);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="creatoros_audit_siem.cef"');
      return res.status(200).send(cefOutput);
    }

    if (format === 'jsonl') {
      const jsonlOutput = securityAuditService.exportToJSONL(events);
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename="creatoros_audit_siem.jsonl"');
      return res.status(200).send(jsonlOutput);
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid export format. Supported formats: cef, jsonl'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAnomalies = async (req, res) => {
  try {
    const result = await securityAuditService.queryLogs({}, { limit: 200 });
    const anomalies = securityAuditService.detectAnomalies(result.logs || []);
    return res.status(200).json({
      success: true,
      count: anomalies.length,
      anomalies
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.recordManualEvent = async (req, res) => {
  try {
    const { category, action, severity, targetResource, metadata, diff } = req.body;
    if (!category || !action) {
      return res.status(400).json({
        success: false,
        error: 'category and action are required fields'
      });
    }

    const event = await securityAuditService.recordEvent({
      category,
      action,
      severity,
      actor: {
        userId: req.user?.id || req.body.userId || 'admin-api',
        email: req.user?.email || req.body.email || 'admin@creatoros.app',
        role: req.user?.role || req.body.role || 'admin',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('user-agent') || 'api'
      },
      targetResource,
      metadata,
      diff
    });

    return res.status(201).json({
      success: true,
      data: event
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
