const NotificationPreference = require("../model/notificationPreference");
const Notification = require("../model/notification");
const User = require("../model/user");
const { isEmailTransportConfigured, createTransporter } = require("../utils/email");

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
 * Uses endTime (not startTime). Overnight windows (e.g. 22:00–08:00) roll
 * the end onto the next calendar day when the end clock time has already
 * passed on the current UTC day relative to `date`.
 * @param {Object} quietHoursConfig
 * @param {Date} [date=new Date()]
 * @returns {Date}
 */
function getQuietHoursEndTime(quietHoursConfig, date = new Date()) {
    const end = new Date(date);
    const endMinutes = parseTimeToMinutes(quietHoursConfig?.endTime || "08:00");
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;

    end.setUTCHours(endHours, endMins, 0, 0);
    // Overnight: e.g. now 23:00, end 08:00 -> today 08:00 has passed, so +1 day.
    // Same-day still inside window: now 02:00, end 08:00 -> today 08:00.
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
                {
                    channel: "in_app",
                    status: "skipped",
                    error: `Category '${category}' is disabled in user preferences`,
                },
            ],
        });
    }

    // 2. Deduplication check
    const dedupEnabled = prefs.deduplication?.enabled ?? true;
    const windowMinutes = prefs.deduplication?.windowMinutes ?? 15;
    if (dedupEnabled && deduplicationKey) {
        const isDup = await isDuplicateNotification(
            userId,
            deduplicationKey,
            category,
            windowMinutes
        );

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
                    {
                        channel: "in_app",
                        status: "skipped",
                        error: "Duplicate notification suppressed by deduplication filter",
                    },
                ],
            });
        }
    }

    // 3. Determine active channels based on preferences
    const targetChannels =
        requestedChannels && requestedChannels.length > 0
            ? requestedChannels
            : ["in_app", "email", "push", "sms"];

    const activeChannels = [];

    if (targetChannels.includes("in_app") && prefs.channels.inApp) {
        activeChannels.push("in_app");
    }
    if (targetChannels.includes("email") && prefs.channels.email) {
        activeChannels.push("email");
    }
    if (targetChannels.includes("push") && prefs.channels.push) {
        activeChannels.push("push");
    }
    if (targetChannels.includes("sms") && prefs.channels.sms) {
        activeChannels.push("sms");
    }

    if (activeChannels.length === 0) {
        return Notification.create({
            userId,
            title,
            message,
            category,
            priority,
            channels: [],
            status: "suppressed",
            deduplicationKey,
            metadata: { ...metadata, suppressionReason: "no_enabled_channels" },
            deliveryLogs: [],
        });
    }

    // 4. Determine whether the notification is explicitly scheduled or deferred by quiet hours.
    const now = new Date();
    let finalStatus = "sent";
    let targetScheduledFor = scheduledFor ? new Date(scheduledFor) : now;
    let schedulingReason = null;

    if (scheduledFor !== undefined && scheduledFor !== null) {
        if (Number.isNaN(targetScheduledFor.getTime())) {
            throw new TypeError("scheduledFor must be a valid date");
        }

        if (targetScheduledFor > now) {
            finalStatus = "scheduled";
            schedulingReason = "scheduled_for_future";
        }
    }

    const quietActive = isQuietHoursActive(prefs.quietHours, now);
    if (quietActive && priority !== "urgent" && finalStatus !== "scheduled") {
        finalStatus = "scheduled";
        targetScheduledFor = getQuietHoursEndTime(prefs.quietHours, now);
        schedulingReason = "quiet_hours";
    }

    const deliveryLogs = [];

    // 5. Channel delivery handling
    if (finalStatus === "sent") {
        deliveryLogs.push(
            ...(await deliverToChannels(userId, activeChannels, title, message))
        );
    } else {
        deliveryLogs.push({
            channel: "in_app",
            status: "delayed",
            error:
                schedulingReason === "scheduled_for_future"
                    ? "Deferred until scheduledFor"
                    : "Deferred due to active Quiet Hours",
        });
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
        sentAt: finalStatus === "sent" ? now : null,
        deduplicationKey,
        metadata,
        deliveryLogs,
    });

    return notification;
}

/**
 * Deliver a notification payload across the given channels.
 * @param {String|ObjectId} userId
 * @param {String[]} channels
 * @param {String} title
 * @param {String} message
 * @returns {Promise<Object[]>}
 */
async function deliverToChannels(userId, channels, title, message) {
    const deliveryLogs = [];

    for (const channel of channels || []) {
        if (channel === "in_app") {
            deliveryLogs.push({ channel: "in_app", status: "success" });
        } else if (channel === "email") {
            try {
                const user = await User.findById(userId);
                if (user && user.email && isEmailTransportConfigured()) {
                    const transporter = createTransporter();
                    await transporter.sendMail({
                        from:
                            process.env.EMAIL_FROM ||
                            '"CreatorOS" <notifications@creatoros.com>',
                        to: user.email,
                        subject: `[CreatorOS] ${title}`,
                        text: message,
                        html: `<div style="font-family:sans-serif; padding:20px;">
                              <h2 style="color:#2563eb;">${title}</h2>
                              <p>${message}</p>
                              <hr style="border:none; border-top:1px solid #e5e7eb; margin:20px 0;" />
                              <small style="color:#6b7280;">Sent via CreatorOS Smart Notifications</small>
                            </div>`,
                    });
                    deliveryLogs.push({ channel: "email", status: "success" });
                } else {
                    deliveryLogs.push({
                        channel: "email",
                        status: "skipped",
                        error: "Email transport or recipient email unavailable",
                    });
                }
            } catch (err) {
                deliveryLogs.push({
                    channel: "email",
                    status: "failed",
                    error: err.message,
                });
            }
        } else if (channel === "push") {
            deliveryLogs.push({
                channel: "push",
                status: "unavailable",
                error: "Push notification delivery is not configured",
            });
        } else if (channel === "sms") {
            deliveryLogs.push({
                channel: "sms",
                status: "unavailable",
                error: "SMS notification delivery is not configured",
            });
        }
    }

    return deliveryLogs;
}

/**
 * Get notification history for a user.
 * @param {String|ObjectId} userId
 * @param {Object} filters
 * @returns {Promise<Object>}
 */
async function getNotificationHistory(userId, filters = {}) {
    const { page = 1, limit = 20, category, status } = filters;
    const query = { userId };
    if (category) query.category = category;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
        Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Notification.countDocuments(query),
    ]);

    return {
        notifications,
        total,
        page,
        pages: Math.ceil(total / limit),
    };
}

/**
 * Mark a notification as read.
 * @param {String|ObjectId} userId
 * @param {String|ObjectId} notificationId
 * @returns {Promise<Document|null>}
 */
async function markAsRead(userId, notificationId) {
    return Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { status: "read", readAt: new Date(), "engagement.readAt": new Date() },
        { new: true }
    );
}

/**
 * Mark all notifications as read for a user.
 * @param {String|ObjectId} userId
 * @returns {Promise<Object>}
 */
async function markAllAsRead(userId) {
    return Notification.updateMany(
        { userId, status: { $in: ["sent", "delivered"] } },
        { status: "read", readAt: new Date(), "engagement.readAt": new Date() }
    );
}

/**
 * Track engagement (open/click) for a notification.
 * @param {String|ObjectId} userId
 * @param {String|ObjectId} notificationId
 * @param {String} action
 * @returns {Promise<Document|null>}
 */
async function trackEngagement(userId, notificationId, action) {
    const update = {};
    if (action === "open") {
        update["engagement.opened"] = true;
        update["engagement.openedAt"] = new Date();
    } else if (action === "click") {
        update["engagement.clicked"] = true;
        update["engagement.clickedAt"] = new Date();
    }
    return Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        update,
        { new: true }
    );
}

/**
 * Archive a notification.
 * @param {String|ObjectId} userId
 * @param {String|ObjectId} notificationId
 * @returns {Promise<Document|null>}
 */
async function archiveNotification(userId, notificationId) {
    return Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { status: "archived", archivedAt: new Date() },
        { new: true }
    );
}

/**
 * Delete a notification.
 * @param {String|ObjectId} userId
 * @param {String|ObjectId} notificationId
 * @returns {Promise<Document|null>}
 */
async function deleteNotification(userId, notificationId) {
    return Notification.findOneAndDelete({ _id: notificationId, userId });
}

/**
 * Get notification analytics for a user.
 * @param {String|ObjectId} userId
 * @returns {Promise<Object>}
 */
async function getNotificationAnalytics(userId) {
    const notifications = await Notification.find({ userId });

    const totalNotifications = notifications.length;
    const totalSent = notifications.filter((n) =>
        ["sent", "delivered", "read"].includes(n.status)
    ).length;
    const totalRead = notifications.filter(
        (n) => n.readAt || n.status === "read"
    ).length;
    const totalClicked = notifications.filter(
        (n) => n.engagement?.clicked
    ).length;

    const archivedCount = notifications.filter(
        (n) => n.status === "archived"
    ).length;
    const suppressedCount = notifications.filter(
        (n) => n.status === "suppressed"
    ).length;

    const categoryStats = {};
    notifications.forEach((n) => {
        if (!categoryStats[n.category]) {
            categoryStats[n.category] = { count: 0, read: 0 };
        }

        categoryStats[n.category].count++;

        if (n.readAt || n.status === "read") {
            categoryStats[n.category].read++;
        }
    });

    const channelStats = {
        in_app: { total: 0, success: 0 },
        email: { total: 0, success: 0 },
        push: { total: 0, success: 0 },
        sms: { total: 0, success: 0 },
    };

    const deliveryStats = {};

    notifications.forEach((n) => {
        for (const log of n.deliveryLogs || []) {
            if (channelStats[log.channel]) {
                channelStats[log.channel].total++;

                if (log.status === "success") {
                    channelStats[log.channel].success++;
                }
            }

            if (!deliveryStats[log.channel]) {
                deliveryStats[log.channel] = { sent: 0, failed: 0 };
            }

            if (log.status === "success") {
                deliveryStats[log.channel].sent++;
            }

            if (log.status === "failed") {
                deliveryStats[log.channel].failed++;
            }
        }
    });

    const deliveryRate =
        totalNotifications > 0
            ? Math.round((totalSent / totalNotifications) * 100)
            : 100;

    const openRate =
        totalSent > 0
            ? Math.round((totalRead / totalSent) * 100)
            : 0;

    const clickRate =
        totalRead > 0
            ? Math.round((totalClicked / totalRead) * 100)
            : 0;

    return {
        totalNotifications,

        // Current analytics fields.
        sentCount: totalSent,
        readCount: totalRead,
        archivedCount,
        suppressedCount,
        clickedCount: totalClicked,
        deliveryRate,
        openRate,
        clickRate,

        // Backward-compatible field names.
        totalSent,
        totalRead,
        totalClicked,

        channelStats,
        categoryStats,
        deliveryStats,
    };
}

/**
 * Process due scheduled notifications. Claims each notification before delivery
 * so concurrent workers cannot send the same notification simultaneously.
 * @returns {Promise<Object>}
 */
async function processDueScheduledNotifications() {
    const now = new Date();
    let processed = 0;
    let sent = 0;
    let failed = 0;

    while (true) {
        const notification = await Notification.findOneAndUpdate(
            {
                status: "scheduled",
                scheduledFor: { $lte: now },
            },
            {
                $set: { status: "sending" },
            },
            {
                new: true,
                sort: { scheduledFor: 1 },
            }
        );

        if (!notification) break;
        processed++;

        try {
            const logs = await deliverToChannels(
                notification.userId,
                notification.channels,
                notification.title,
                notification.message
            );
            notification.deliveryLogs.push(...logs);
            notification.status = "sent";
            notification.sentAt = new Date();
            await notification.save();
            sent++;
        } catch (err) {
            notification.status = "failed";
            notification.deliveryLogs.push({
                channel: "in_app",
                status: "failed",
                error: err.message,
            });
            await notification.save();
            failed++;
        }
    }

    return { processed, sent, failed };
}

module.exports = {
    getOrCreatePreferences,
    updatePreferences,
    isQuietHoursActive,
    getQuietHoursEndTime,
    isDuplicateNotification,
    sendNotification,
    deliverToChannels,
    getNotificationHistory,
    markAsRead,
    markAllAsRead,
    trackEngagement,
    archiveNotification,
    deleteNotification,
    getNotificationAnalytics,
    processDueScheduledNotifications,
};
