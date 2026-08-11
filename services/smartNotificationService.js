const NotificationPreference = require("../model/notificationPreference");
const Notification = require("../model/notification");
const User = require("../model/user");
const { isEmailTransportConfigured, createTransporter } = require("../utils/email");

/**
 * Escape a string for safe inclusion in an HTML email body.
 * @param {String} str
 * @returns {String}
 */
function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Get or create default notification preferences for a user.
 * @param {String|ObjectId} userId
 * @returns {Promise<Document>}
 */
async function getOrCreatePreferences(userId) {
    let prefs = await NotificationPreference.findOne({ userId });
    if (!prefs) {
        prefs = await NotificationPreference.create({ userId });
    }
    return prefs;
}

/**
 * Update user notification preferences.
 * @param {String|ObjectId} userId
 * @param {Object} updateData
 * @returns {Promise<Document>}
 */
async function updatePreferences(userId, updateData) {
    let prefs = await NotificationPreference.findOne({ userId });
    if (!prefs) {
        prefs = new NotificationPreference({ userId, ...updateData });
    } else {
        if (updateData.channels) {
            prefs.channels = { ...prefs.channels.toObject(), ...updateData.channels };
        }
        if (updateData.categories) {
            prefs.categories = { ...prefs.categories.toObject(), ...updateData.categories };
        }
        if (updateData.quietHours) {
            prefs.quietHours = { ...prefs.quietHours.toObject(), ...updateData.quietHours };
        }
        if (updateData.intelligentScheduling) {
            prefs.intelligentScheduling = {
                ...prefs.intelligentScheduling.toObject(),
                ...updateData.intelligentScheduling,
            };
        }
        if (updateData.deduplication) {
            prefs.deduplication = {
                ...prefs.deduplication.toObject(),
                ...updateData.deduplication,
            };
        }
    }
    await prefs.save();
    return prefs;
}

/**
 * Helper to parse "HH:mm" time string into minutes since midnight.
 * @param {String} timeStr
 * @returns {Number}
 */
function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return 0;
    const parts = timeStr.split(":").map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/**
 * Check if the given date/time falls within quiet hours.
 * @param {Object} quietHoursConfig
 * @param {Date} [date=new Date()]
 * @returns {Boolean}
 */
function isQuietHoursActive(quietHoursConfig, date = new Date()) {
    if (!quietHoursConfig || !quietHoursConfig.enabled) {
        return false;
    }

    const currentMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    const startMinutes = parseTimeToMinutes(quietHoursConfig.startTime);
    const endMinutes = parseTimeToMinutes(quietHoursConfig.endTime);

    if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else if (startMinutes > endMinutes) {
        // Overnight quiet hours e.g. 22:00 to 08:00
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return false; // Equal start & end
}

/**
 * Calculate the next Date when quiet hours end.
 * @param {Object} quietHoursConfig
 * @param {Date} [date=new Date()]
 * @returns {Date}
 */
function getQuietHoursEndTime(quietHoursConfig, date = new Date()) {
    const end = new Date(date);
    const endMinutes = parseTimeToMinutes(quietHoursConfig.startTime || "08:00");
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;

    end.setUTCHours(endHours, endMins, 0, 0);
    if (end <= date) {
        end.setUTCDate(end.getUTCDate() + 1);
    }
    return end;
}

/**
 * Check if a duplicate notification exists within the deduplication window.
 * @param {String|ObjectId} userId
 * @param {String} deduplicationKey
 * @param {String} category
 * @param {Number} windowMinutes
 * @returns {Promise<Boolean>}
 */
async function isDuplicateNotification(userId, deduplicationKey, category, windowMinutes = 15) {
    if (!deduplicationKey) return false;

    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    const existing = await Notification.findOne({
        userId,
        deduplicationKey,
        createdAt: { $gte: windowStart },
    });

    return !!existing;
}

/**
 * Send or schedule a smart notification.
 * @param {String|ObjectId} userId
 * @param {Object} payload
 * @returns {Promise<Document>}
 */
async function sendNotification(userId, payload) {
    const {
        title,
        message,
        category = "system",
        priority = "normal",
        channels: requestedChannels,
        metadata = {},
        deduplicationKey,
        scheduledFor,
    } = payload;

    const prefs = await getOrCreatePreferences(userId);

    // 1. Category preference check
    if (prefs.categories && !prefs.categories[category]) {
        return Notification.create({
            userId,
            title,
            message,
            category,
            priority,
            channels: [],
            status: "suppressed",
            deduplicationKey,
            metadata: { ...metadata, suppressionReason: "category_disabled" },
            deliveryLogs: [
                { channel: "in_app", status: "skipped", error: `Category '${category}' is disabled in user preferences` },
            ],
        });
    }

    // 2. Deduplication check
    const dedupEnabled = prefs.deduplication?.enabled ?? true;
    const windowMinutes = prefs.deduplication?.windowMinutes ?? 15;
    if (dedupEnabled && deduplicationKey) {
        const isDup = await isDuplicateNotification(userId, deduplicationKey, category, windowMinutes);
        if (isDup) {
            return Notification.create({
                userId,
                title,
                message,
                category,
                priority,
                channels: [],
                status: "suppressed",
                deduplicationKey,
                metadata: { ...metadata, suppressionReason: "duplicate_suppressed" },
                deliveryLogs: [
                    { channel: "in_app", status: "skipped", error: "Duplicate notification suppressed by deduplication filter" },
                ],
            });
        }
    }

    // 3. Determine active channels based on preferences
    let activeChannels = [];
    const targetChannels = requestedChannels && requestedChannels.length > 0
        ? requestedChannels
        : ["in_app", "email", "push", "sms"];

    if (targetChannels.includes("in_app") && prefs.channels.inApp) activeChannels.push("in_app");
    if (targetChannels.includes("email") && prefs.channels.email) activeChannels.push("email");
    if (targetChannels.includes("push") && prefs.channels.push) activeChannels.push("push");
    if (targetChannels.includes("sms") && prefs.channels.sms) activeChannels.push("sms");

    if (activeChannels.length === 0) {
        activeChannels = ["in_app"]; // fallback to in_app if available
    }

    // 4. Quiet hours & Intelligent scheduling
    let finalStatus = "sent";
    let targetScheduledFor = scheduledFor ? new Date(scheduledFor) : new Date();

    const quietActive = isQuietHoursActive(prefs.quietHours, new Date());
    if (quietActive && priority !== "urgent") {
        finalStatus = "scheduled";
        targetScheduledFor = getQuietHoursEndTime(prefs.quietHours, new Date());
    }

    const deliveryLogs = [];

    // 5. Channel delivery handling
    if (finalStatus === "sent") {
        for (const channel of activeChannels) {
            if (channel === "in_app") {
                deliveryLogs.push({ channel: "in_app", status: "success" });
            } else if (channel === "email") {
                try {
                    const user = await User.findById(userId);
                    if (user && user.email && isEmailTransportConfigured()) {
                        const transporter = createTransporter();
                        await transporter.sendMail({
                            from: process.env.EMAIL_FROM || '"CreatorOS" <notifications@creatoros.com>',
                            to: user.email,
                            subject: `[CreatorOS] ${title}`,
                            text: message,
                            html: `<div style="font-family:sans-serif; padding:20px;">
                              <h2 style="color:#2563eb;">${escapeHtml(title)}</h2>
                              <p>${escapeHtml(message)}</p>
                              <hr style="border:none; border-top:1px solid #e5e7eb; margin:20px 0;" />
                              <small style="color:#6b7280;">Sent via CreatorOS Smart Notifications</small>
                            </div>`,
                        });
                        deliveryLogs.push({ channel: "email", status: "success" });
                    } else {
                        deliveryLogs.push({ channel: "email", status: "skipped", error: "Email transport or recipient email unavailable" });
                    }
                } catch (err) {
                    deliveryLogs.push({ channel: "email", status: "failed", error: err.message });
                }
            } else if (channel === "push") {
                // Multi-channel Push Notification Handler simulator
                deliveryLogs.push({ channel: "push", status: "success" });
            } else if (channel === "sms") {
                // Multi-channel SMS Delivery Handler simulator
                deliveryLogs.push({ channel: "sms", status: "success" });
            }
        }
    } else {
        deliveryLogs.push({ channel: "in_app", status: "delayed", error: "Deferred due to active Quiet Hours" });
    }

    const notification = await Notification.create({
        userId,
        title,
        message,
        category,
        priority,
        channels: activeChannels,
        status: finalStatus,
        scheduledFor: targetScheduledFor,
        sentAt: finalStatus === "sent" ? new Date() : null,
        deduplicationKey,
        metadata,
        deliveryLogs,
    });

    return notification;
}

/**
 * Fetch paginated notification history with filters.
 * @param {String|ObjectId} userId
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function getNotificationHistory(userId, options = {}) {
    const {
        category,
        channel,
        status,
        search,
        page = 1,
        limit = 20,
    } = options;

    const query = { userId };

    if (category && category !== "all") {
        query.category = category;
    }
    if (channel && channel !== "all") {
        query.channels = channel;
    }
    if (status && status !== "all") {
        if (status === "unread") {
            query.readAt = null;
            query.status = { $in: ["sent", "delivered", "scheduled", "pending"] };
        } else if (status === "read") {
            query.readAt = { $ne: null };
        } else if (status === "archived") {
            query.status = "archived";
        } else {
            query.status = status;
        }
    } else {
        // By default omit archived unless specifically requested or status=all
        if (status !== "all") {
            query.status = { $ne: "archived" };
        }
    }

    if (search) {
        query.$or = [
            { title: { $regex: search, $options: "i" } },
            { message: { $regex: search, $options: "i" } },
        ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        Notification.countDocuments(query),
        Notification.countDocuments({
            userId,
            readAt: null,
            status: { $in: ["sent", "delivered", "pending"] },
        }),
    ]);

    return {
        notifications,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limitNum) || 1,
        unreadCount,
    };
}

/**
 * Get unread notifications count for topbar badge.
 * @param {String|ObjectId} userId
 * @returns {Promise<Number>}
 */
async function getUnreadCount(userId) {
    return Notification.countDocuments({
        userId,
        readAt: null,
        status: { $in: ["sent", "delivered", "pending"] },
    });
}

/**
 * Mark notification as read.
 * @param {String|ObjectId} userId
 * @param {String|ObjectId} notificationId
 * @returns {Promise<Document>}
 */
async function markAsRead(userId, notificationId) {
    const notification = await Notification.findOne({ _id: notificationId, userId });
    if (!notification) {
        throw new Error("Notification not found");
    }
    notification.readAt = new Date();
    notification.status = notification.status === "archived" ? "archived" : "read";
    notification.engagement = notification.engagement || {};
    notification.engagement.opened = true;
    notification.engagement.readAt = new Date();
    await notification.save();
    return notification;
}

/**
 * Mark all notifications for a user as read.
 * @param {String|ObjectId} userId
 * @returns {Promise<Object>}
 */
async function markAllAsRead(userId) {
    const now = new Date();
    const result = await Notification.updateMany(
        { userId, readAt: null, status: { $ne: "archived" } },
        {
            $set: {
                readAt: now,
                status: "read",
                "engagement.opened": true,
                "engagement.readAt": now,
            },
        }
    );
    return result;
}

/**
 * Archive a notification.
 * @param {String|ObjectId} userId
 * @param {String|ObjectId} notificationId
 * @returns {Promise<Document>}
 */
async function archiveNotification(userId, notificationId) {
    const notification = await Notification.findOne({ _id: notificationId, userId });
    if (!notification) {
        throw new Error("Notification not found");
    }
    notification.status = "archived";
    notification.archivedAt = new Date();
    await notification.save();
    return notification;
}

/**
 * Delete a notification.
 * @param {String|ObjectId} userId
 * @param {String|ObjectId} notificationId
 * @returns {Promise<Boolean>}
 */
async function deleteNotification(userId, notificationId) {
    const result = await Notification.deleteOne({ _id: notificationId, userId });
    return result.deletedCount > 0;
}

/**
 * Track user engagement on a notification (open or click).
 * @param {String|ObjectId} userId
 * @param {String|ObjectId} notificationId
 * @param {String} action - "open" | "click"
 * @returns {Promise<Document>}
 */
async function trackEngagement(userId, notificationId, action = "open") {
    const notification = await Notification.findOne({ _id: notificationId, userId });
    if (!notification) {
        throw new Error("Notification not found");
    }

    if (!notification.engagement) {
        notification.engagement = {};
    }

    const now = new Date();
    if (action === "open") {
        notification.engagement.opened = true;
        notification.engagement.readAt = notification.engagement.readAt || now;
        notification.readAt = notification.readAt || now;
        if (notification.status !== "archived") notification.status = "read";
    } else if (action === "click") {
        notification.engagement.clicked = true;
        notification.engagement.clickedAt = now;
    }

    await notification.save();
    return notification;
}

/**
 * Generate analytics metrics for creator notifications.
 * @param {String|ObjectId} userId
 * @returns {Promise<Object>}
 */
async function getNotificationAnalytics(userId) {
    const allNotifications = await Notification.find({ userId });

    const total = allNotifications.length;
    let sentCount = 0;
    let readCount = 0;
    let archivedCount = 0;
    let suppressedCount = 0;
    let clickedCount = 0;

    const channelStats = {
        in_app: { total: 0, success: 0 },
        email: { total: 0, success: 0 },
        push: { total: 0, success: 0 },
        sms: { total: 0, success: 0 },
    };

    const categoryStats = {
        system: 0,
        engagement: 0,
        content: 0,
        analytics: 0,
        marketing: 0,
    };

    allNotifications.forEach((item) => {
        if (item.status === "sent" || item.status === "delivered" || item.status === "read") {
            sentCount++;
        }
        if (item.readAt || item.status === "read") readCount++;
        if (item.status === "archived") archivedCount++;
        if (item.status === "suppressed") suppressedCount++;
        if (item.engagement?.clicked) clickedCount++;

        if (categoryStats[item.category] !== undefined) {
            categoryStats[item.category]++;
        }

        item.deliveryLogs.forEach((log) => {
            if (channelStats[log.channel]) {
                channelStats[log.channel].total++;
                if (log.status === "success") {
                    channelStats[log.channel].success++;
                }
            }
        });
    });

    const deliveryRate = total > 0 ? Math.round((sentCount / total) * 100) : 100;
    const openRate = sentCount > 0 ? Math.round((readCount / sentCount) * 100) : 0;
    const clickRate = readCount > 0 ? Math.round((clickedCount / readCount) * 100) : 0;

    return {
        totalNotifications: total,
        sentCount,
        readCount,
        archivedCount,
        suppressedCount,
        clickedCount,
        deliveryRate,
        openRate,
        clickRate,
        channelStats,
        categoryStats,
    };
}

module.exports = {
    getOrCreatePreferences,
    updatePreferences,
    isQuietHoursActive,
    getQuietHoursEndTime,
    isDuplicateNotification,
    sendNotification,
    getNotificationHistory,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    trackEngagement,
    getNotificationAnalytics,
};
