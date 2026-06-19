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

router.get("/:creatorId/snapshots", validateCreatorId, getSnapshots);
router.get("/:creatorId/snapshots/latest", validateCreatorId, getLatestSnapshot);
router.get("/:creatorId/engagement-history", validateCreatorId, getEngagementHistory);
router.post("/:creatorId/refresh", validateCreatorId, triggerRefresh);

module.exports = router;