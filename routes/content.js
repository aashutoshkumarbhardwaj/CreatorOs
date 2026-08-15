const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    scheduleContent,
    listScheduledContent,
    cancelScheduledContent,
    bulkScheduleContent,
} = require('../controller/contentController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

/**
 * @swagger
 * /schedule:
 *   post:
 *     summary: Schedule content for future publishing
 *     description: Creates a piece of content scheduled to auto-publish at a future UTC time.
 *     responses:
 *       201:
 *         description: Content scheduled successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/schedule', scheduleContent);

/**
 * @swagger
 * /scheduled:
 *   get:
 *     summary: List the signed-in creator's scheduled content
 *     responses:
 *       200:
 *         description: Successful response
 *       401:
 *         description: Unauthorized
 */
router.get('/scheduled', listScheduledContent);

/**
 * @swagger
 * /scheduled/{id}:
 *   delete:
 *     summary: Cancel a piece of scheduled content
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.delete('/scheduled/:id', cancelScheduledContent);

router.post('/schedule/bulk', upload.single('file'), bulkScheduleContent);

module.exports = router;
