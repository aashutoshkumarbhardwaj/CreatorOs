const User = require("../model/user");
const smartNotificationService = require("../services/smartNotificationService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Builds user view model for sidebar/topbar rendering.
 * @param {Object} userDoc
 * @param {Object} fallbackUser
 * @returns {Object}
 */
function buildAccountViewModel(userDoc, fallbackUser) {
    const name = userDoc?.name || fallbackUser?.name || "Creator";
    const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "CR";

    return {
        id: fallbackUser?.id || userDoc?._id,
        name,
        email: userDoc?.email || fallbackUser?.email || "",
        initials,
    };
}

/**
 * Render Smart Notifications page view.
 */
const renderSmartNotificationsPage = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    let userDoc = null;
    try {
        userDoc = await User.findById(userId);
    } catch (e) {
        // fallback if user lookup fails
    }

    const accountUser = buildAccountViewModel(userDoc, req.user);
    const preferences = await smartNotificationService.getOrCreatePreferences(userId);
    const { notifications, unreadCount } = await smartNotificationService.getNotificationHistory(userId, { limit: 20 });
    const analytics = await smartNotificationService.getNotificationAnalytics(userId);

    res.render("smart-notifications", {
        user: accountUser,
        activeNav: "smart-notifications",
        preferences,
        initialNotifications: notifications,
        unreadCount,
        analytics,
    });
});

/**
 * Get notification preferences.
 */
const getPreferences = asyncHandler(async (req, res) => {
    const preferences = await smartNotificationService.getOrCreatePreferences(req.user.id);
    res.json({ success: true, data: preferences });
});

/**
 * Update notification preferences.
 */
const updatePreferences = asyncHandler(async (req, res) => {
    const preferences = await smartNotificationService.updatePreferences(req.user.id, req.body);
    res.json({ success: true, message: "Notification preferences updated successfully", data: preferences });
});

/**
 * Get paginated notifications list.
 */
const getNotifications = asyncHandler(async (req, res) => {
    const history = await smartNotificationService.getNotificationHistory(req.user.id, req.query);
    res.json({ success: true, ...history });
});

/**
 * Get unread notifications count.
 */
const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await smartNotificationService.getUnreadCount(req.user.id);
    res.json({ success: true, count });
});

/**
 * Create/send smart notification.
 */
const createNotification = asyncHandler(async (req, res) => {
    const { title, message, category, priority, channels, metadata, deduplicationKey, scheduledFor } = req.body;

    if (!title || !message) {
        return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    const notification = await smartNotificationService.sendNotification(req.user.id, {
        title,
        message,
        category,
        priority,
        channels,
        metadata,
        deduplicationKey,
        scheduledFor,
    });

    res.status(201).json({
        success: true,
        message: notification.status === "scheduled" ? "Notification scheduled" : "Notification sent",
        data: notification,
    });
});

/**
 * Send a test notification across channels for creator demo.
 */
const sendTestNotification = asyncHandler(async (req, res) => {
    const { channel = "all", category = "system" } = req.body;
    const channels = channel === "all" ? ["in_app", "email", "push", "sms"] : [channel];

    const notification = await smartNotificationService.sendNotification(req.user.id, {
        title: `🧪 Test Smart Notification (${category.toUpperCase()})`,
        message: `This is a test notification sent to channel: ${channel}. Your Smart Notifications system is working properly!`,
        category,
        priority: "normal",
        channels,
        deduplicationKey: `test_notification_${Date.now()}`,
    });

    res.status(201).json({
        success: true,
        message: "Test notification sent successfully!",
        data: notification,
    });
});

/**
 * Mark notification as read.
 */
const markAsRead = asyncHandler(async (req, res) => {
    const notification = await smartNotificationService.markAsRead(req.user.id, req.params.id);
    res.json({ success: true, message: "Marked as read", data: notification });
});

/**
 * Mark all notifications as read.
 */
const markAllAsRead = asyncHandler(async (req, res) => {
    const result = await smartNotificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: "All notifications marked as read", modifiedCount: result.modifiedCount });
});

/**
 * Archive a notification.
 */
const archiveNotification = asyncHandler(async (req, res) => {
    const notification = await smartNotificationService.archiveNotification(req.user.id, req.params.id);
    res.json({ success: true, message: "Notification archived", data: notification });
});

/**
 * Delete a notification.
 */
const deleteNotification = asyncHandler(async (req, res) => {
    const success = await smartNotificationService.deleteNotification(req.user.id, req.params.id);
    if (!success) {
        return res.status(404).json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, message: "Notification deleted" });
});

/**
 * Track notification engagement.
 */
const trackEngagement = asyncHandler(async (req, res) => {
    const { action = "open" } = req.body;
    const notification = await smartNotificationService.trackEngagement(req.user.id, req.params.id, action);
    res.json({ success: true, data: notification });
});

/**
 * Get notification analytics.
 */
const getAnalytics = asyncHandler(async (req, res) => {
    const analytics = await smartNotificationService.getNotificationAnalytics(req.user.id);
    res.json({ success: true, data: analytics });
});

module.exports = {
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
};
