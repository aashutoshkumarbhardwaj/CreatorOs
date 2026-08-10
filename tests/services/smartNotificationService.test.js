const mongoose = require("mongoose");
const Notification = require("../../model/notification");
const NotificationPreference = require("../../model/notificationPreference");
const User = require("../../model/user");
const smartNotificationService = require("../../services/smartNotificationService");

describe("smartNotificationService", () => {
    let testUserId;

    beforeEach(async () => {
        await Notification.deleteMany({});
        await NotificationPreference.deleteMany({});
        await User.deleteMany({});

        const user = await User.create({
            name: "Test Creator",
            email: "creator@example.com",
            password: "password123",
            isVerified: true,
        });
        testUserId = user._id;
    });

    describe("Preferences Management", () => {
        it("should create default preferences if none exist", async () => {
            const prefs = await smartNotificationService.getOrCreatePreferences(testUserId);
            expect(prefs.userId.toString()).toBe(testUserId.toString());
            expect(prefs.channels.email).toBe(true);
        });

        it("should update preferences correctly", async () => {
            const updated = await smartNotificationService.updatePreferences(testUserId, {
                channels: { sms: true },
                quietHours: { enabled: true, startTime: "23:00", endTime: "07:00" },
            });
            expect(updated.channels.sms).toBe(true);
            expect(updated.quietHours.enabled).toBe(true);
            expect(updated.quietHours.startTime).toBe("23:00");
        });
    });

    describe("Quiet Hours Logic", () => {
        it("should return false if quiet hours disabled", () => {
            const config = { enabled: false, startTime: "22:00", endTime: "08:00" };
            expect(smartNotificationService.isQuietHoursActive(config)).toBe(false);
        });

        it("should detect active quiet hours correctly for overnight range", () => {
            const config = { enabled: true, startTime: "22:00", endTime: "08:00" };

            // 23:00 UTC date
            const nightTime = new Date(Date.UTC(2026, 6, 30, 23, 0, 0));
            expect(smartNotificationService.isQuietHoursActive(config, nightTime)).toBe(true);

            // 12:00 UTC date
            const dayTime = new Date(Date.UTC(2026, 6, 30, 12, 0, 0));
            expect(smartNotificationService.isQuietHoursActive(config, dayTime)).toBe(false);
        });
    });

    describe("Deduplication Logic", () => {
        it("should return true for duplicate notification within window", async () => {
            await Notification.create({
                userId: testUserId,
                title: "Repeated Alert",
                message: "Same message",
                deduplicationKey: "dup_key_1",
            });

            const isDup = await smartNotificationService.isDuplicateNotification(
                testUserId,
                "dup_key_1",
                "system",
                15
            );
            expect(isDup).toBe(true);
        });

        it("should return false for different deduplicationKey", async () => {
            await Notification.create({
                userId: testUserId,
                title: "Alert 1",
                message: "Msg",
                deduplicationKey: "dup_key_1",
            });

            const isDup = await smartNotificationService.isDuplicateNotification(
                testUserId,
                "dup_key_2",
                "system",
                15
            );
            expect(isDup).toBe(false);
        });
    });

    describe("Notification Dispatch & Delivery", () => {
        it("should dispatch and save a notification", async () => {
            const notif = await smartNotificationService.sendNotification(testUserId, {
                title: "New Follower",
                message: "You gained a new follower!",
                category: "engagement",
                priority: "normal",
            });

            expect(notif.status).toBe("sent");
            expect(notif.category).toBe("engagement");
            expect(notif.deliveryLogs.length).toBeGreaterThan(0);
        });

        it("should suppress notification if category disabled by creator", async () => {
            await smartNotificationService.updatePreferences(testUserId, {
                categories: { marketing: false },
            });

            const notif = await smartNotificationService.sendNotification(testUserId, {
                title: "Special Offer",
                message: "Buy pro plan now",
                category: "marketing",
            });

            expect(notif.status).toBe("suppressed");
            expect(notif.metadata.suppressionReason).toBe("category_disabled");
        });

        it("should suppress duplicate notification if deduplication active", async () => {
            await smartNotificationService.sendNotification(testUserId, {
                title: "Spammy Alert",
                message: "Message",
                deduplicationKey: "spam_key",
            });

            const dupNotif = await smartNotificationService.sendNotification(testUserId, {
                title: "Spammy Alert",
                message: "Message",
                deduplicationKey: "spam_key",
            });

            expect(dupNotif.status).toBe("suppressed");
            expect(dupNotif.metadata.suppressionReason).toBe("duplicate_suppressed");
        });
    });

    describe("History, Status Updates & Engagement", () => {
        it("should fetch notification history with filters and pagination", async () => {
            await Notification.create({
                userId: testUserId,
                title: "Unread System Alert",
                message: "Details",
                category: "system",
                status: "sent",
            });
            await Notification.create({
                userId: testUserId,
                title: "Unread Engagement",
                message: "Details",
                category: "engagement",
                status: "sent",
            });

            const history = await smartNotificationService.getNotificationHistory(testUserId, {
                category: "system",
            });

            expect(history.total).toBe(1);
            expect(history.notifications[0].title).toBe("Unread System Alert");
        });

        it("should mark single and all notifications as read", async () => {
            const n1 = await Notification.create({
                userId: testUserId,
                title: "N1",
                message: "M1",
                status: "sent",
            });
            const n2 = await Notification.create({
                userId: testUserId,
                title: "N2",
                message: "M2",
                status: "sent",
            });

            await smartNotificationService.markAsRead(testUserId, n1._id);
            const updatedN1 = await Notification.findById(n1._id);
            expect(updatedN1.status).toBe("read");
            expect(updatedN1.readAt).not.toBeNull();

            await smartNotificationService.markAllAsRead(testUserId);
            const updatedN2 = await Notification.findById(n2._id);
            expect(updatedN2.status).toBe("read");
        });

        it("should track engagement click and open actions", async () => {
            const n = await Notification.create({
                userId: testUserId,
                title: "Link Alert",
                message: "Click here",
                status: "sent",
            });

            await smartNotificationService.trackEngagement(testUserId, n._id, "click");
            const updated = await Notification.findById(n._id);
            expect(updated.engagement.clicked).toBe(true);
        });

        it("should calculate correct notification analytics", async () => {
            await Notification.create({
                userId: testUserId,
                title: "N1",
                message: "M1",
                status: "sent",
                readAt: new Date(),
                category: "system",
                deliveryLogs: [{ channel: "in_app", status: "success" }],
            });

            const analytics = await smartNotificationService.getNotificationAnalytics(testUserId);
            expect(analytics.totalNotifications).toBe(1);
            expect(analytics.readCount).toBe(1);
            expect(analytics.openRate).toBe(100);
        });
    });
});
