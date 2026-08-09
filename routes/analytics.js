const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const {
    getSnapshots,
    getLatestSnapshot,
    triggerRefresh,
    getEngagementHistory,
    getCreatorsByUser,
} = require("../controller/analytics");
const { validate, objectIdParamSchema } = require("../middleware/validators");
const { createRateLimitStore } = require("../utils/rateLimitStore");

const validateCreatorId = validate(objectIdParamSchema, 'params');

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    store: createRateLimitStore(),
    message: "Too many refresh attempts, please try again after 15 minutes.",
});

router.get("/creators", getCreatorsByUser);
router.get("/:creatorId/snapshots", validateCreatorId, getSnapshots);
router.get("/:creatorId/snapshots/latest", validateCreatorId, getLatestSnapshot);
router.get("/:creatorId/engagement-history", validateCreatorId, getEngagementHistory);
router.post("/:creatorId/refresh", validateCreatorId, refreshLimiter, triggerRefresh);

module.exports = router;