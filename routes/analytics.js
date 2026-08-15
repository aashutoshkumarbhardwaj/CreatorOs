const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const {
    getSnapshots,
    getLatestSnapshot,
    triggerRefresh,
    getEngagementHistory,
    getCreatorsByUser,
    getAnalyticsSummary,
    getLiveCount,
    exportAnalyticsCsv,
} = require("../controller/analytics");
const { validate, objectIdParamSchema } = require("../middleware/validators");
const { instagramLimiter } = require("../middleware/rateLimiters");

const validateCreatorId = validate(objectIdParamSchema, 'params');

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: "Too many refresh attempts, please try again after 15 minutes.",
});

router.get("/summary", getAnalyticsSummary);
router.get("/live-count", getLiveCount);
router.get("/export", exportAnalyticsCsv);
router.get("/creators", getCreatorsByUser);
router.get("/:creatorId/snapshots", validateCreatorId, instagramLimiter, getSnapshots);
router.get("/:creatorId/snapshots/latest", validateCreatorId, instagramLimiter, getLatestSnapshot);
router.get("/:creatorId/engagement-history", validateCreatorId, instagramLimiter, getEngagementHistory);
router.post("/:creatorId/refresh", validateCreatorId, refreshLimiter, instagramLimiter, triggerRefresh);

module.exports = router;