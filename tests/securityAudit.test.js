const assert = require('assert');
const securityAuditService = require('../services/securityAuditService');
const { auditAction } = require('../middleware/securityAuditMiddleware');

async function runTests() {
  console.log('--- Running Security Audit & SIEM Tests ---');

  // 1. Record Event
  const event1 = await securityAuditService.recordEvent({
    category: 'ACCESS_CONTROL',
    action: 'USER_ROLE_ELEVATED',
    severity: 'HIGH',
    actor: {
      userId: 'admin-101',
      email: 'admin@creatoros.app',
      role: 'superadmin',
      ipAddress: '192.168.1.5'
    },
    targetResource: {
      resourceType: 'UserRole',
      resourceId: 'user-202'
    },
    diff: {
      before: { role: 'editor' },
      after: { role: 'admin' }
    }
  });

  assert.ok(event1.eventId);
  assert.ok(event1.integrityHash);
  assert.strictEqual(event1.action, 'USER_ROLE_ELEVATED');
  assert.strictEqual(event1.severity, 'HIGH');

  // 2. Querying Events
  const queryRes = await securityAuditService.queryLogs({ category: 'ACCESS_CONTROL' });
  assert.ok(queryRes.logs.length >= 1);
  const found = queryRes.logs.find((e) => e.eventId === event1.eventId);
  assert.ok(found);
  assert.strictEqual(found.actor.userId, 'admin-101');

  // 3. CEF Export
  const cefOutput = securityAuditService.exportToCEF([event1]);
  assert.ok(cefOutput.includes('CEF:0|CreatorOS|AuditEngine|1.0|ACCESS_CONTROL|USER_ROLE_ELEVATED|8|'));
  assert.ok(cefOutput.includes('src=192.168.1.5'));
  assert.ok(cefOutput.includes('suser=admin@creatoros.app'));

  // 4. JSONL Export
  const jsonlOutput = securityAuditService.exportToJSONL([event1]);
  const parsed = JSON.parse(jsonlOutput);
  assert.strictEqual(parsed.eventId, event1.eventId);
  assert.strictEqual(parsed.category, 'ACCESS_CONTROL');

  // 5. Anomaly Detection: Excessive Failures
  const failureEvents = [];
  for (let i = 0; i < 6; i++) {
    failureEvents.push({
      category: 'AUTH',
      action: 'LOGIN_ATTEMPT',
      status: 'FAILURE',
      actor: { ipAddress: '10.0.0.99', userId: 'attacker' }
    });
  }
  const anomalies = securityAuditService.detectAnomalies(failureEvents);
  assert.strictEqual(anomalies.length, 1);
  assert.strictEqual(anomalies[0].type, 'EXCESSIVE_FAILURES_DETECTED');
  assert.strictEqual(anomalies[0].identifier, 'attacker');

  // 6. Anomaly Detection: Privilege Elevation
  const elevationAnomalies = securityAuditService.detectAnomalies([event1]);
  assert.strictEqual(elevationAnomalies.length, 1);
  assert.strictEqual(elevationAnomalies[0].type, 'PRIVILEGE_ELEVATION_EVENT');

  // 7. Middleware Interceptor Mock Test
  const mockReq = {
    user: { id: 'test-user', email: 'test@example.com', role: 'creator' },
    ip: '127.0.0.1',
    originalUrl: '/api/v1/resource',
    baseUrl: '/api/v1',
    path: '/resource',
    get: () => 'TestAgent/1.0',
    params: { id: 'res-123' },
    query: {}
  };

  let middlewareCalledNext = false;
  const mockRes = {
    statusCode: 200,
    json: function (payload) {
      return payload;
    },
    send: function (payload) {
      return payload;
    }
  };

  const middleware = auditAction('STORE_TRANSACTION', 'CHECKOUT_ORDER', 'INFO');
  middleware(mockReq, mockRes, () => {
    middlewareCalledNext = true;
  });

  assert.strictEqual(middlewareCalledNext, true);
  // Trigger json response
  mockRes.json({ orderId: 999 });

  console.log('✓ All 7 Security Audit & SIEM tests passed successfully!');
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
