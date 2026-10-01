const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DurableOfflineQueue } = require('../services/durableOfflineQueue');
const OfflineQueueReplayWorker = require('../workers/offlineQueueReplayWorker');

async function runTests() {
  console.log('--- Running Durable Offline Queue Tests ---');
  const tempDir = path.join(os.tmpdir(), `creatoros_wal_test_${Date.now()}`);

  try {
    const queue = new DurableOfflineQueue({
      walDirectory: tempDir,
      maxBatchSize: 10,
      retryLimit: 2
    });

    // 1. Initial State
    assert.strictEqual(queue.getMode(), 'PRIMARY_ACTIVE');

    // 2. Normal Enqueue
    const normalRes = await queue.enqueue('emails', { to: 'user@example.com' });
    assert.strictEqual(normalRes.status, 'ENQUEUED_PRIMARY');
    assert.strictEqual(queue.getPendingOfflineTasks('emails').length, 0);

    // 3. Fallback / Degraded Enqueue
    queue.setDegradedMode(true);
    assert.strictEqual(queue.getMode(), 'WAL_OFFLINE_FALLBACK');

    const walRes1 = await queue.enqueue('emails', { to: 'offline1@example.com', body: 'hello' });
    assert.strictEqual(walRes1.status, 'BUFFERED_TO_WAL');
    assert.ok(walRes1.entryId);
    assert.ok(walRes1.checksum);

    const walRes2 = await queue.enqueue('emails', { to: 'offline2@example.com', body: 'world' });
    assert.strictEqual(walRes2.status, 'BUFFERED_TO_WAL');

    const pending = queue.getPendingOfflineTasks('emails');
    assert.strictEqual(pending.length, 2);
    assert.strictEqual(pending[0].payload.to, 'offline1@example.com');
    assert.strictEqual(pending[1].payload.to, 'offline2@example.com');

    // 4. Drain and Compaction
    const processed = [];
    const drainRes = await queue.drain('emails', async (payload) => {
      processed.push(payload.to);
    });

    assert.strictEqual(drainRes.drainedCount, 2);
    assert.strictEqual(drainRes.remainingCount, 0);
    assert.deepStrictEqual(processed, ['offline1@example.com', 'offline2@example.com']);

    // 5. DLQ on Repeated Failure
    await queue.enqueue('failing_queue', { attempt: 1 });
    // First drain attempt - fails
    await queue.drain('failing_queue', async () => {
      throw new Error('Simulated broker outage');
    });
    // Second drain attempt - hits limit 2 and transitions to DLQ
    await queue.drain('failing_queue', async () => {
      throw new Error('Simulated broker outage 2');
    });

    const activeRemaining = queue.getPendingOfflineTasks('failing_queue');
    assert.strictEqual(activeRemaining.length, 0);

    const dlqItems = queue.getPendingOfflineTasks('failing_queue_dlq');
    assert.strictEqual(dlqItems.length, 1);
    assert.strictEqual(dlqItems[0].payload.payload.attempt, 1);

    // 6. Worker Cycle Test
    queue.setDegradedMode(false);
    await queue.enqueue('worker_queue', { job: 'analytics_sync' }, { forceFallback: true });

    let workerProcessed = 0;
    const worker = new OfflineQueueReplayWorker({ queueInstance: queue, pollIntervalMs: 1000 });
    worker.registerHandler('worker_queue', async () => {
      workerProcessed++;
    });

    const cycleRes = await worker.runCycle();
    assert.strictEqual(cycleRes.status, 'CYCLE_COMPLETED');
    assert.strictEqual(workerProcessed, 1);
    assert.strictEqual(queue.getPendingOfflineTasks('worker_queue').length, 0);

    console.log('✓ All 6 Durable Offline Queue tests passed successfully!');
  } finally {
    // Cleanup temporary files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
