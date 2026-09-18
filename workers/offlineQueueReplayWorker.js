const { defaultQueueInstance } = require('../services/durableOfflineQueue');

/**
 * Offline Queue Replay Worker Daemon
 * Automatically monitors durable WAL files and replays pending offline records
 * once network/broker connectivity has stabilized.
 */
class OfflineQueueReplayWorker {
  constructor(options = {}) {
    this.queue = options.queueInstance || defaultQueueInstance;
    this.pollIntervalMs = options.pollIntervalMs || 5000;
    this.handlers = new Map();
    this.timer = null;
    this.isRunning = false;
    this.replayedTotal = 0;
  }

  /**
   * Register a processor handler for a specific queue topic
   */
  registerHandler(queueName, handlerFn) {
    this.handlers.set(queueName, handlerFn);
  }

  /**
   * Start the background polling and replay loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      await this.runCycle();
    }, this.pollIntervalMs);

    // Prevent blocking process exit if worker is idle
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop background polling
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  /**
   * Execute one replay cycle across all registered queue handlers
   */
  async runCycle() {
    if (this.queue.isDegraded) {
      // Primary broker still offline, postpone replay
      return { status: 'SKIPPED_STILL_DEGRADED' };
    }

    const results = [];

    for (const [queueName, handlerFn] of this.handlers.entries()) {
      try {
        const stats = this.queue.getStats(queueName);
        if (stats.pendingDiskRecords > 0) {
          const drainResult = await this.queue.drain(queueName, handlerFn);
          this.replayedTotal += drainResult.drainedCount;
          results.push(drainResult);
        }
      } catch (err) {
        console.error(`[OfflineQueueReplayWorker] Error during drain cycle for ${queueName}:`, err.message);
      }
    }

    return {
      status: 'CYCLE_COMPLETED',
      results,
      replayedTotal: this.replayedTotal
    };
  }

  getWorkerStatus() {
    return {
      isRunning: this.isRunning,
      pollIntervalMs: this.pollIntervalMs,
      registeredQueues: Array.from(this.handlers.keys()),
      replayedTotal: this.replayedTotal
    };
  }
}

module.exports = OfflineQueueReplayWorker;
