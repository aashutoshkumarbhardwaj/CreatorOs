const express = require('express');
const router = express.Router();
const securityAuditController = require('../controller/securityAuditController');

/**
 * @route   GET /api/security-audit/logs
 * @desc    Query and filter security audit log entries
 */
router.get('/logs', securityAuditController.getAuditLogs);

/**
 * @route   GET /api/security-audit/export
 * @desc    Export audit log stream formatted in CEF or JSONL for SIEM ingest
 */
router.get('/export', securityAuditController.exportSIEM);

/**
 * @route   GET /api/security-audit/anomalies
 * @desc    Detect privilege escalation or brute force anomaly spikes
 */
router.get('/anomalies', securityAuditController.getAnomalies);

/**
 * @route   POST /api/security-audit/events
 * @desc    Record manual or external security/compliance event
 */
router.post('/events', securityAuditController.recordManualEvent);

module.exports = router;
