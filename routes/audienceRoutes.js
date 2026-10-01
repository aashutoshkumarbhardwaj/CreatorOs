const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  addSubscriber,
  importSubscribersBatch,
  getSubscribers,
  handleUnsubscribe,
  createCampaign,
  sendCampaignBroadcast,
  recordTrackingPixelOpen,
  getAudienceAnalytics,
} = require("../controller/audienceController");

// Public endpoints
router.post("/subscribe", addSubscriber);
router.get("/unsubscribe/:token", handleUnsubscribe);
router.get("/track/open/:campaignId/:subscriberId", recordTrackingPixelOpen);

// Creator protected routes
router.use(protect);
router.get("/subscribers", getSubscribers);
router.post("/subscribers/batch-import", importSubscribersBatch);
router.post("/campaigns", createCampaign);
router.post("/campaigns/:id/send", sendCampaignBroadcast);
router.get("/analytics", getAudienceAnalytics);

module.exports = router;
