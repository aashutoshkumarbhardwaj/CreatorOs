const { defaultQueueInstance } = require('../services/durableOfflineQueue');

/**
 * Controller for Durable Offline Queue Monitoring & Control
 */
exports.getQueueStats = (req, res) => {
  try {
    const queueName = req.params.queueName || 'general_tasks';
    const stats = defaultQueueInstance.getStats(queueName);
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.setMode = (req, res) => {
  try {
    const { degraded } = req.body;
    if (typeof degraded !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'degraded field must be boolean'
      });
    }

    defaultQueueInstance.setDegradedMode(degraded);
    return res.status(200).json({
      success: true,
      mode: defaultQueueInstance.getMode(),
      isDegraded: defaultQueueInstance.isDegraded
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.enqueueTask = async (req, res) => {
  try {
    const { queueName, payload, forceFallback } = req.body;
    if (!queueName || !payload) {
      return res.status(400).json({
        success: false,
        error: 'queueName and payload are required'
      });
    }

    const result = await defaultQueueInstance.enqueue(queueName, payload, { forceFallback });
    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.drainQueue = async (req, res) => {
  try {
    const { queueName } = req.params;
    if (!queueName) {
      return res.status(400).json({ success: false, error: 'queueName is required' });
    }

    // Default mock drainer for testing
    const drainResult = await defaultQueueInstance.drain(queueName, async (item) => {
      // Process offline item
      return true;
    });

    return res.status(200).json({
      success: true,
      data: drainResult
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.purgeQueue = (req, res) => {
  try {
    const { queueName } = req.params;
    const purged = defaultQueueInstance.purge(queueName);
    return res.status(200).json({
      success: true,
      purged,
      queueName
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
