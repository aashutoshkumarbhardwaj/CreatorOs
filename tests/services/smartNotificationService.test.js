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

            const nightTime = new Date(Date.UTC(2026, 6, 30, 23, 0, 0));
            expect(smartNotificationService.isQuietHoursActive(config, nightTime)).toBe(true);

            const dayTime = new Date(Date.UTC(2026, 6, 30, 12, 0, 0));
            expect(smartNotificationService.isQuietHoursActive(config, dayTime)).toBe(false);
        });

        it("getQuietHoursEndTime uses endTime and handles overnight windows", () => {
            const config = { enabled: true, startTime: "22:00", endTime: "08:00" };

            const lateNight = new Date(Date.UTC(2026, 6, 30, 23, 15, 0));
            const endLate = smartNotificationService.getQuietHoursEndTime(config, lateNight);
            expect(endLate.toISOString()).toBe("2026-07-31T08:00:00.000Z");

            const earlyMorning = new Date(Date.UTC(2026, 6, 31, 2, 30, 0));
            const endEarly = smartNotificationService.getQuietHoursEndTime(config, earlyMorning);
            expect(endEarly.toISOString()).toBe("2026-07-31T08:00:00.000Z");
        });

        it("getQuietHoursEndTime handles same-day quiet windows", () => {
            const config = { enabled: true, startTime: "12:00", endTime: "14:00" };
            const midday = new Date(Date.UTC(2026, 6, 30, 13, 0, 0));
            const end = smartNotificationService.getQuietHoursEndTime(config, midday);
            expect(end.toISOString()).toBe("2026-07-30T14:00:00.000Z");
        });
    });

    describe("Scheduled notification flush", () => {
        it("claims due scheduled notifications and marks them sent", async () => {
            const due = await Notification.create({
                userId: testUserId,
                title: "Quiet deferral",
                message: "Deliver after quiet hours",
                status: "scheduled",
                scheduledFor: new Date(Date.now() - 60 * 1000),
                channels: ["in_app"],
                deliveryLogs: [
                    { channel: "in_app", status: "delayed", error: "Deferred due to active Quiet Hours" },
                ],
            });
            const future = await Notification.create({
                userId: testUserId,
                title: "Not due",
                message: "Later",
                status: "scheduled",
                scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
                channels: ["in_app"],
            });

            const result = await smartNotificationService.processDueScheduledNotifications();
            expect(result.processed).toBe(1);
            expect(result.sent).toBe(1);
            expect(result.failed).toBe(0);

            const refreshedDue = await Notification.findById(due._id);
            expect(refreshedDue.status).toBe("sent");
            expect(refreshedDue.sentAt).toBeInstanceOf(Date);
            expect(refreshedDue.deliveryLogs.some((l) => l.status === "success")).toBe(true);

            const refreshedFuture = await Notification.findById(future._id);
            expect(refreshedFuture.status).toBe("scheduled");
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

        it("should schedule a future notification without delivering it immediately", async () => {
            const scheduledFor = new Date(Date.now() + 60 * 60 * 1000);

            const notif = await smartNotificationService.sendNotification(testUserId, {
                title: "Scheduled Alert",
                message: "Deliver this later",
                category: "system",
                priority: "normal",
                channels: ["in_app"],
                scheduledFor,
            });

            expect(notif.status).toBe("scheduled");
            expect(notif.sentAt).toBeNull();
            expect(notif.scheduledFor.getTime()).toBe(scheduledFor.getTime());
            expect(notif.deliveryLogs).toHaveLength(1);
            expect(notif.deliveryLogs[0].channel).toBe("in_app");
            expect(notif.deliveryLogs[0].status).toBe("delayed");
            expect(notif.deliveryLogs[0].error).toBe("Deferred until scheduledFor");

            const result = await smartNotificationService.processDueScheduledNotifications();
            expect(result.processed).toBe(0);

            const stillScheduled = await Notification.findById(notif._id);
            expect(stillScheduled.status).toBe("scheduled");
        });

        it("should deliver an explicitly scheduled notification once it is due", async () => {
            const scheduledFor = new Date(Date.now() - 60 * 1000);

            const notif = await smartNotificationService.sendNotification(testUserId, {
                title: "Due Alert",
                message: "Deliver this now",
                category: "system",
                priority: "normal",
                channels: ["in_app"],
                scheduledFor,
            });

            expect(notif.status).toBe("sent");
            expect(notif.sentAt).toBeInstanceOf(Date);
        });

        it("should reject an invalid scheduledFor value", async () => {
            await expect(
                smartNotificationService.sendNotification(testUserId, {
                    title: "Invalid Schedule",
                    message: "This should fail",
                    scheduledFor: "not-a-date",
                })
            ).rejects.toThrow("scheduledFor must be a valid date");

            expect(await Notification.countDocuments({ userId: testUserId })).toBe(0);
        });

        it("should suppress notification when every requested channel is disabled", async () => {
            await smartNotificationService.updatePreferences(testUserId, {
                channels: {
                    inApp: false,
                    email: false,
                    push: false,
                    sms: false,
                },
            });

            const notif = await smartNotificationService.sendNotification(testUserId, {
                title: "Disabled Channels",
                message: "This should not be delivered through a fallback channel",
                category: "system",
            });

            expect(notif.status).toBe("suppressed");
            expect(notif.channels).toEqual([]);
            expect(notif.metadata.suppressionReason).toBe("no_enabled_channels");
            expect(notif.deliveryLogs).toEqual([]);
        });

        it("should not fall back to in-app when the requested channel is disabled", async () => {
            await smartNotificationService.updatePreferences(testUserId, {
                channels: {
                    inApp: false,
                    email: false,
                    push: false,
                    sms: false,
                },
            });

            const notif = await smartNotificationService.sendNotification(testUserId, {
                title: "Email Opt-Out",
                message: "This should remain suppressed",
                category: "system",
                channels: ["email"],
            });

            expect(notif.status).toBe("suppressed");
            expect(notif.channels).toEqual([]);
            expect(notif.metadata.suppressionReason).toBe("no_enabled_channels");
            expect(notif.deliveryLogs).toEqual([]);
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