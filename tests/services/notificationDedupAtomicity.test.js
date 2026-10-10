const mongoose = require("mongoose");
const Notification = require("../../model/notification");
const NotificationPreference = require("../../model/notificationPreference");
const smartNotificationService = require("../../services/smartNotificationService");

describe("smartNotificationService deduplication atomicity and lease recovery", () => {
    let userId;

    beforeEach(async () => {
        await Notification.deleteMany({});
        await NotificationPreference.deleteMany({});
        await Notification.syncIndexes();
        userId = new mongoose.Types.ObjectId();
    });

    const send = (extra = {}) =>
        smartNotificationService.sendNotification(userId, {
            title: "Alert",
            message: "Body",
            channels: ["in_app"],
            ...extra,
        });

    it("records a duplicate as suppressed instead of throwing E11000", async () => {
        const first = await send({ deduplicationKey: "k1" });
        const second = await send({ deduplicationKey: "k1" });

        expect(first.status).toBe("sent");
        expect(second.status).toBe("suppressed");
        expect(second.metadata.suppressionReason).toBe("duplicate_suppressed");
        expect(second.metadata.duplicateOf.toString()).toBe(first._id.toString());
        expect(second.deduplicationKey).toBeUndefined();
    });

    it("lets exactly one of many concurrent identical sends through", async () => {
        const results = await Promise.all(
            Array.from({ length: 6 }, () => send({ deduplicationKey: "race" }))
        );

        expect(results.filter((n) => n.status === "sent")).toHaveLength(1);
        expect(results.filter((n) => n.status === "suppressed")).toHaveLength(5);
        expect(await Notification.countDocuments({ userId, deduplicationKey: "race" })).toBe(1);
    });

    it("allows a deduplication key to be reused once the window has elapsed", async () => {
        const old = await send({ deduplicationKey: "reuse" });
        await Notification.collection.updateOne(
            { _id: old._id },
            { $set: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } }
        );

        const fresh = await send({ deduplicationKey: "reuse" });

        expect(fresh.status).toBe("sent");
        expect(fresh._id.toString()).not.toBe(old._id.toString());
        const retired = await Notification.findById(old._id).lean();
        expect(retired.deduplicationKey).toBeUndefined();
        expect(retired.metadata.retiredDeduplicationKey).toBe("reuse");
    });

    it("does not let suppressed records hold the deduplication key", async () => {
        await smartNotificationService.getOrCreatePreferences(userId);
        const suppressed = await send({ category: "marketing", deduplicationKey: "mk" });
        expect(suppressed.status).toBe("suppressed");
        expect(suppressed.deduplicationKey).toBeUndefined();

        await smartNotificationService.updatePreferences(userId, { categories: { marketing: true } });
        const delivered = await send({ category: "marketing", deduplicationKey: "mk" });
        expect(delivered.status).toBe("sent");
    });

    it("sends every time when deduplication is disabled in preferences", async () => {
        await smartNotificationService.updatePreferences(userId, { deduplication: { enabled: false } });

        const a = await send({ deduplicationKey: "off" });
        const b = await send({ deduplicationKey: "off" });

        expect(a.status).toBe("sent");
        expect(b.status).toBe("sent");
    });

    it("reclaims notifications stuck in 'sending' and delivers them", async () => {
        const stuck = await Notification.create({
            userId,
            title: "Stuck",
            message: "Body",
            channels: ["in_app"],
            status: "sending",
            scheduledFor: new Date(Date.now() - 60 * 60 * 1000),
        });
        await Notification.collection.updateOne(
            { _id: stuck._id },
            { $set: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) } }
        );

        const result = await smartNotificationService.processDueScheduledNotifications();

        expect(result.reclaimed).toBe(1);
        expect(result.sent).toBe(1);
        expect((await Notification.findById(stuck._id)).status).toBe("sent");
    });

    it("does not reclaim a 'sending' notification whose lease is still fresh", async () => {
        const live = await Notification.create({
            userId,
            title: "Live",
            message: "Body",
            channels: ["in_app"],
            status: "sending",
            scheduledFor: new Date(Date.now() - 1000),
        });

        const result = await smartNotificationService.processDueScheduledNotifications();

        expect(result.reclaimed).toBe(0);
        expect((await Notification.findById(live._id)).status).toBe("sending");
    });
});
