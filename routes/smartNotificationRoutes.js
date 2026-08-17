const express = require("express");
const router = express.Router();
const {
    renderSmartNotificationsPage,
    getPreferences,
    updatePreferences,
    getNotifications,
    getUnreadCount,
    createNotification,
    sendTestNotification,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    trackEngagement,
    getAnalytics,
} = require("../controller/smartNotificationController");
const { protect, preventContributorWrites } = require("../middleware/auth");

const {
  validatePreferences,
  validateCreateNotification,
} = require("../middleware/validators/smartNotificationValidator");

// UI View Pages
router.get("/services/smart-notifications", protect, renderSmartNotificationsPage);
router.get("/notifications", protect, renderSmartNotificationsPage);

// API Endpoints
router.get("/api/notifications", protect, getNotifications);
router.get("/api/notifications/unread-count", protect, getUnreadCount);
router.get("/api/notifications/preferences", protect, getPreferences);
router.put("/api/notifications/preferences", protect, preventContributorWrites, validatePreferences, updatePreferences);
router.get("/api/notifications/analytics", protect, getAnalytics);

router.post("/api/notifications", protect, preventContributorWrites, validateCreateNotification, createNotification);
router.post("/api/notifications/test", protect, preventContributorWrites, sendTestNotification);

router.patch("/api/notifications/read-all", protect, markAllAsRead);
router.patch("/api/notifications/:id/read", protect, markAsRead);
router.patch("/api/notifications/:id/archive", protect, archiveNotification);
router.post("/api/notifications/:id/engagement", protect, trackEngagement);
router.delete("/api/notifications/:id", protect, preventContributorWrites, deleteNotification);

module.exports = router;
