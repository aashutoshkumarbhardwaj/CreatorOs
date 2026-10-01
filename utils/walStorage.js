const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Write-Ahead Log (WAL) Storage Utility
 * Provides append-only, checksum-verified persistent disk logging
 * for disaster recovery and offline queue buffering.
 */
class WalStorage {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(process.cwd(), 'data', 'wal');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  getQueueFilePath(queueName) {
    const sanitized = queueName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, `${sanitized}.wal`);
  }

  computeChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Append an entry atomically to the WAL log
   */
  append(queueName, payload) {
    this.ensureDirectory();
    const filePath = this.getQueueFilePath(queueName);
    const entryId = crypto.randomUUID();
    const timestamp = Date.now();

    const recordData = JSON.stringify({
      id: entryId,
      timestamp,
      queue: queueName,
      payload
    });

    const checksum = this.computeChecksum(recordData);
    const logLine = `${entryId}|${timestamp}|${checksum}|${recordData}\n`;

    fs.appendFileSync(filePath, logLine, 'utf8');

    return {
      id: entryId,
      timestamp,
      checksum,
      success: true
    };
  }

  /**
   * Read all uncorrupted records from the WAL log
   */
  readAll(queueName) {
    const filePath = this.getQueueFilePath(queueName);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const validRecords = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 4) continue;

      const [id, timestamp, recordedChecksum, ...payloadParts] = parts;
      const rawPayload = payloadParts.join('|');

      const expectedChecksum = this.computeChecksum(rawPayload);
      if (expectedChecksum !== recordedChecksum) {
        console.warn(`[WalStorage] Corrupted record detected in queue ${queueName}, id: ${id}. Skipping.`);
        continue;
      }

      try {
        const parsed = JSON.parse(rawPayload);
        validRecords.push(parsed);
      } catch (err) {
        console.error(`[WalStorage] Failed to parse JSON record ${id}:`, err.message);
      }
    }

    return validRecords;
  }

  /**
   * Rewrite log excluding processed entry IDs (Compaction)
   */
  compact(queueName, processedIds) {
    const filePath = this.getQueueFilePath(queueName);
    if (!fs.existsSync(filePath)) return 0;

    const processedSet = new Set(processedIds);
    const allRecords = this.readAll(queueName);
    const remaining = allRecords.filter((r) => !processedSet.has(r.id));

    const tempFilePath = `${filePath}.tmp.${Date.now()}`;
    const lines = remaining.map((r) => {
      const raw = JSON.stringify(r);
      const checksum = this.computeChecksum(raw);
      return `${r.id}|${r.timestamp}|${checksum}|${raw}`;
    });

    fs.writeFileSync(tempFilePath, lines.length > 0 ? lines.join('\n') + '\n' : '', 'utf8');
    fs.renameSync(tempFilePath, filePath);

    return processedIds.length;
  }

  /**
   * Remove entire WAL file for a queue
   */
  purge(queueName) {
    const filePath = this.getQueueFilePath(queueName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

module.exports = WalStorage;
