const mongoose = require("mongoose");
const Notification = require("../../model/notification");
const NotificationPreference = require("../../model/notificationPreference");

describe("Smart Notification Models", () => {
    afterEach(async () => {
        await Notification.deleteMany({});
        await NotificationPreference.deleteMany({});
    });

    describe("NotificationPreference Model", () => {
        it("should create default notification preference for a user", async () => {
            const userId = new mongoose.Types.ObjectId();
            const pref = await NotificationPreference.create({ userId });

            expect(pref.userId.toString()).toBe(userId.toString());
            expect(pref.channels.email).toBe(true);
            expect(pref.channels.inApp).toBe(true);
            expect(pref.categories.system).toBe(true);
            expect(pref.quietHours.enabled).toBe(false);
            expect(pref.intelligentScheduling.enabled).toBe(true);
            expect(pref.deduplication.windowMinutes).toBe(15);
        });

        it("should enforce unique userId index", async () => {
            const userId = new mongoose.Types.ObjectId();
            await NotificationPreference.create({ userId });

            await expect(NotificationPreference.create({ userId })).rejects.toThrow();
        });
    });

    describe("Notification Model", () => {
        it("should create a notification document with defaults", async () => {
            const userId = new mongoose.Types.ObjectId();
            const notification = await Notification.create({
                userId,
                title: "Test Alert",
                message: "Test message body",
            });

            expect(notification.userId.toString()).toBe(userId.toString());
            expect(notification.title).toBe("Test Alert");
            expect(notification.category).toBe("system");
            expect(notification.priority).toBe("normal");
            expect(notification.status).toBe("pending");
            expect(notification.engagement.opened).toBe(false);
        });

        it("should validate enum constraints", async () => {
            const userId = new mongoose.Types.ObjectId();
            await expect(
                Notification.create({
                    userId,
                    title: "Bad Category",
                    message: "Msg",
                    category: "invalid_cat",
                })
            ).rejects.toThrow();
        });
    });
});
