const express = require("express");
const router = express.Router();
const {
    getSnapshots,
    getLatestSnapshot,
    triggerRefresh,
    getEngagementHistory,
} = require("../controller/analytics");
const { validate, objectIdParamSchema } = require("../middleware/validators");

const validateCreatorId = validate(objectIdParamSchema, 'params');

/**
 * @swagger
 * /api/analytics/{creatorId}/snapshots:
 *   get:
 *     summary: Get all analytics snapshots
 *     description: Retrieves a list of analytics snapshots for a specific creator.
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of snapshots
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Creator not found
 */
router.get("/:creatorId/snapshots", validateCreatorId, getSnapshots);

/**
 * @swagger
 * /api/analytics/{creatorId}/snapshots/latest:
 *   get:
 *     summary: Get the latest analytics snapshot
 *     description: Retrieves the most recent analytics snapshot for a specific creator.
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The latest snapshot
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Snapshot or Creator not found
 */
router.get("/:creatorId/snapshots/latest", validateCreatorId, getLatestSnapshot);

/**
 * @swagger
 * /api/analytics/{creatorId}/engagement-history:
 *   get:
 *     summary: Get engagement history
 *     description: Retrieves the engagement history over time for a specific creator.
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Engagement history data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Creator not found
 */
router.get("/:creatorId/engagement-history", validateCreatorId, getEngagementHistory);

/**
 * @swagger
 * /api/analytics/{creatorId}/refresh:
 *   post:
 *     summary: Trigger analytics refresh
 *     description: Manually triggers a refresh of the analytics data for a specific creator.
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Refresh triggered successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Creator not found
 */
router.post("/:creatorId/refresh", validateCreatorId, triggerRefresh);

module.exports = router;