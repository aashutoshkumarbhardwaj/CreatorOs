const express = require("express");
const router = express.Router();
const {
    getSnapshots,
    getLatestSnapshot,
    triggerRefresh,
    getEngagementHistory,
} = require("../controller/analytics");


/**
 * @swagger
 * /:creatorId/snapshots:
 *   get:
 *     summary: GET request for /:creatorId/snapshots
 *     description: Automatically generated swagger documentation for /:creatorId/snapshots
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:creatorId/snapshots", getSnapshots);

/**
 * @swagger
 * /:creatorId/snapshots/latest:
 *   get:
 *     summary: GET request for /:creatorId/snapshots/latest
 *     description: Automatically generated swagger documentation for /:creatorId/snapshots/latest
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:creatorId/snapshots/latest", getLatestSnapshot);

/**
 * @swagger
 * /:creatorId/engagement-history:
 *   get:
 *     summary: GET request for /:creatorId/engagement-history
 *     description: Automatically generated swagger documentation for /:creatorId/engagement-history
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:creatorId/engagement-history", getEngagementHistory);

/**
 * @swagger
 * /:creatorId/refresh:
 *   post:
 *     summary: POST request for /:creatorId/refresh
 *     description: Automatically generated swagger documentation for /:creatorId/refresh
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/:creatorId/refresh", triggerRefresh);

module.exports = router;