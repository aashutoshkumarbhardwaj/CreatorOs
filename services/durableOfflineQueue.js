const WalStorage = require('../utils/walStorage');

/**
 * Durable Offline Queue Service
 * Ensures zero message loss during broker outages, Redis crashes, or network partitions
 * by seamlessly falling back to a persistent, atomic Write-Ahead Log (WAL).
 */
class DurableOfflineQueue {
  constructor(options = {}) {
    this.wal = new WalStorage(options.walDirectory);
    this.isDegraded = options.isDegraded || false;
    this.activeWorkers = new Map();
    this.maxBatchSize = options.maxBatchSize || 50;
    this.retryLimit = options.retryLimit || 3;
    this.failureCounts = new Map();
  }

  /**
   * Toggle broker health state (can be triggered by Redis error listeners)
   */
  setDegradedMode(degraded) {
    this.isDegraded = Boolean(degraded);
  }

  getMode() {
    return this.isDegraded ? 'WAL_OFFLINE_FALLBACK' : 'PRIMARY_ACTIVE';
  }

  /**
   * Enqueue a task. If degraded mode is active or forceFallback is true,
   * writes directly to the durable disk WAL.
   */
  async enqueue(queueName, payload, options = {}) {
    if (!queueName) throw new Error('queueName is required');

    const shouldUseWal = this.isDegraded || options.forceFallback;

    if (shouldUseWal) {
      const record = this.wal.append(queueName, payload);
      return {
        status: 'BUFFERED_TO_WAL',
        mode: 'OFFLINE_DISK_PERSISTED',
        entryId: record.id,
        timestamp: record.timestamp,
        checksum: record.checksum
      };
    }

    // In normal operation, tasks route directly through in-memory/primary dispatcher
    return {
      status: 'ENQUEUED_PRIMARY',
      mode: 'ONLINE',
      queueName,
      payload
    };
  }

  /**
   * Inspect all pending offline tasks across a given queue
   */
  getPendingOfflineTasks(queueName) {
    return this.wal.readAll(queueName);
  }

  /**
   * Drain and replay offline WAL entries through a processor function
   */
  async drain(queueName, handlerFn) {
    if (typeof handlerFn !== 'function') {
      throw new Error('Handler function must be supplied to drain the queue');
    }

    const pending = this.wal.readAll(queueName);
    if (pending.length === 0) {
      return {
        queueName,
        drainedCount: 0,
        failedCount: 0,
        remainingCount: 0
      };
    }

    const processedIds = [];
    const failedIds = [];

    const batch = pending.slice(0, this.maxBatchSize);

    for (const record of batch) {
      const currentFails = this.failureCounts.get(record.id) || 0;

      try {
        await handlerFn(record.payload, record);
        processedIds.push(record.id);
        this.failureCounts.delete(record.id);
      } catch (err) {
        const nextFails = currentFails + 1;
        this.failureCounts.set(record.id, nextFails);

        if (nextFails >= this.retryLimit) {
          console.error(`[DurableQueue] Task ${record.id} exceeded retry limit (${this.retryLimit}). Moving to DLQ.`);
          processedIds.push(record.id); // Compact it out of active queue into DLQ
          this.wal.append(`${queueName}_dlq`, {
            ...record,
            dlqReason: err.message,
            abandonedAt: Date.now()
          });
        } else {
          failedIds.push(record.id);
        }
      }
    }

    if (processedIds.length > 0) {
      this.wal.compact(queueName, processedIds);
    }

    const remaining = this.wal.readAll(queueName).length;

    return {
      queueName,
      drainedCount: processedIds.length,
      failedCount: failedIds.length,
      remainingCount: remaining
    };
  }

  /**
   * Get queue statistics and health report
   */
  getStats(queueName) {
    const activePending = this.wal.readAll(queueName).length;
    const dlqCount = this.wal.readAll(`${queueName}_dlq`).length;

    return {
      queueName,
      mode: this.getMode(),
      isDegraded: this.isDegraded,
      pendingDiskRecords: activePending,
      deadLetterRecords: dlqCount,
      walDirectory: this.wal.baseDir
    };
  }

  /**
   * Purge a queue entirely
   */
  purge(queueName) {
    return this.wal.purge(queueName);
  }
}

// Global singleton instance for app-wide resilience
const defaultQueueInstance = new DurableOfflineQueue();

module.exports = {
  DurableOfflineQueue,
  defaultQueueInstance
};
