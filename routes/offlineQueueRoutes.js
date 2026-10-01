const express = require('express');
const router = express.Router();
const offlineQueueController = require('../controller/offlineQueueController');

/**
 * @route   GET /api/offline-queue/stats/:queueName?
 * @desc    Get queue health and pending disk records
 */
router.get('/stats/:queueName?', offlineQueueController.getQueueStats);

/**
 * @route   POST /api/offline-queue/mode
 * @desc    Simulate or set degraded / recovery broker mode
 */
router.post('/mode', offlineQueueController.setMode);

/**
 * @route   POST /api/offline-queue/enqueue
 * @desc    Enqueue task with optional forceFallback
 */
router.post('/enqueue', offlineQueueController.enqueueTask);

/**
 * @route   POST /api/offline-queue/drain/:queueName
 * @desc    Trigger manual replay/drain of an offline WAL queue
 */
router.post('/drain/:queueName', offlineQueueController.drainQueue);

/**
 * @route   DELETE /api/offline-queue/:queueName
 * @desc    Purge a WAL log file
 */
router.delete('/:queueName', offlineQueueController.purgeQueue);

module.exports = router;
