const crypto = require('crypto');
const SecurityAuditLog = require('../model/securityAuditLog');

/**
 * Enterprise Security Audit & SIEM Service
 */
class SecurityAuditService {
  constructor() {
    this.memoryBuffer = [];
    this.maxBufferLimit = 1000;
  }

  /**
   * Log a security or compliance event
   */
  async recordEvent(eventData) {
    const event = {
      eventId: eventData.eventId || crypto.randomUUID(),
      category: eventData.category || 'ADMIN_MUTATION',
      action: eventData.action,
      severity: eventData.severity || 'INFO',
      actor: {
        userId: eventData.actor?.userId || 'system',
        email: eventData.actor?.email || 'system@local',
        role: eventData.actor?.role || 'system',
        ipAddress: eventData.actor?.ipAddress || '127.0.0.1',
        userAgent: eventData.actor?.userAgent || 'internal'
      },
      targetResource: {
        resourceType: eventData.targetResource?.resourceType || 'system',
        resourceId: eventData.targetResource?.resourceId || null
      },
      metadata: eventData.metadata || {},
      diff: eventData.diff || null,
      status: eventData.status || 'SUCCESS',
      createdAt: new Date()
    };

    const canonical = `${event.eventId}:${event.category}:${event.action}:${event.actor.userId}:${event.createdAt.getTime()}`;
    event.integrityHash = crypto.createHash('sha256').update(canonical).digest('hex');

    // Attempt Mongoose save if connected, otherwise buffer locally
    try {
      if (SecurityAuditLog.db?.readyState === 1) {
        return await SecurityAuditLog.create(event);
      }
    } catch (err) {
      console.warn('[SecurityAudit] Database unavailable, buffering to memory:', err.message);
    }

    // Buffer in memory
    this.memoryBuffer.push(event);
    if (this.memoryBuffer.length > this.maxBufferLimit) {
      this.memoryBuffer.shift();
    }

    return event;
  }

  /**
   * Search audit trail with filters
   */
  async queryLogs(filters = {}, pagination = {}) {
    const page = Math.max(1, parseInt(pagination.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 25));

    const query = {};
    if (filters.category) query.category = filters.category;
    if (filters.severity) query.severity = filters.severity;
    if (filters.action) query.action = filters.action;
    if (filters.userId) query['actor.userId'] = filters.userId;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    try {
      if (SecurityAuditLog.db?.readyState === 1) {
        const total = await SecurityAuditLog.countDocuments(query);
        const docs = await SecurityAuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        return {
          total,
          page,
          limit,
          logs: docs
        };
      }
    } catch (err) {
      console.warn('[SecurityAudit] Query failed against DB, reading from memory buffer');
    }

    // Fallback to memory buffer
    let filtered = [...this.memoryBuffer];
    if (filters.category) filtered = filtered.filter((e) => e.category === filters.category);
    if (filters.severity) filtered = filtered.filter((e) => e.severity === filters.severity);
    if (filters.action) filtered = filtered.filter((e) => e.action === filters.action);

    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      total: filtered.length,
      page,
      limit,
      logs: paginated
    };
  }

  /**
   * Export events in Common Event Format (CEF) for SIEM ingest
   */
  exportToCEF(events = []) {
    return events.map((e) => {
      const timestamp = new Date(e.createdAt).toISOString();
      const severityNum = { INFO: 1, LOW: 3, MEDIUM: 5, HIGH: 8, CRITICAL: 10 }[e.severity] || 1;
      return `CEF:0|CreatorOS|AuditEngine|1.0|${e.category}|${e.action}|${severityNum}|rt=${timestamp} src=${e.actor?.ipAddress || ''} suser=${e.actor?.email || ''} cs1=${e.targetResource?.resourceType || ''} cs2=${e.targetResource?.resourceId || ''} act=${e.status}`;
    }).join('\n');
  }

  /**
   * Export events in JSON Lines (JSONL)
   */
  exportToJSONL(events = []) {
    return events.map((e) => JSON.stringify(e)).join('\n');
  }

  /**
   * Analyze audit logs for security anomalies (e.g. repeated failures or elevation)
   */
  detectAnomalies(events = []) {
    const userFailures = {};
    const anomalies = [];

    for (const e of events) {
      if (e.status === 'FAILURE' || e.status === 'DENIED') {
        const key = e.actor?.userId || e.actor?.ipAddress || 'unknown';
        userFailures[key] = (userFailures[key] || 0) + 1;
        if (userFailures[key] === 5) {
          anomalies.push({
            type: 'EXCESSIVE_FAILURES_DETECTED',
            identifier: key,
            failureCount: userFailures[key],
            severity: 'HIGH'
          });
        }
      }

      if (e.category === 'ACCESS_CONTROL' && e.action.includes('ELEVATE')) {
        anomalies.push({
          type: 'PRIVILEGE_ELEVATION_EVENT',
          actor: e.actor,
          targetResource: e.targetResource,
          severity: 'CRITICAL'
        });
      }
    }

    return anomalies;
  }
}

module.exports = new SecurityAuditService();
