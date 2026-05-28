const express = require("express");
const router = express.Router();
const {
    getSnapshots,
    getLatestSnapshot,
    triggerRefresh,
    getEngagementHistory,
} = require("../controller/analytics");

router.get("/:creatorId/snapshots", getSnapshots);
router.get("/:creatorId/snapshots/latest", getLatestSnapshot);
router.get("/:creatorId/engagement-history", getEngagementHistory);
router.post("/:creatorId/refresh", triggerRefresh);

module.exports = router;