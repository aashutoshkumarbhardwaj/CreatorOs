const mongoose = require("mongoose");
const DmDelivery = require("../model/dmDelivery");
const {
    reserveDmDelivery,
    markDmDeliverySent,
    releaseDmDelivery,
} = require("../services/dmDeliveryService");

describe("DM delivery idempotency", () => {
    beforeAll(async () => {
        await DmDelivery.init();
    });

    beforeEach(async () => {
        await DmDelivery.deleteMany({});
    });

    it("claims a delivery once and rejects duplicate claims", async () => {
        const creatorId = new mongoose.Types.ObjectId();
        const eventId = "instagram-mid-100";

        const first = await reserveDmDelivery(creatorId, eventId);
        const second = await reserveDmDelivery(creatorId, eventId);

        expect(first.claimed).toBe(true);
        expect(second.claimed).toBe(false);
        expect(second.delivery.status).toBe("reserved");
        expect(await DmDelivery.countDocuments({ creatorId, eventId })).toBe(1);
    });

    it("marks a delivery as sent and preserves the sent state", async () => {
        const creatorId = new mongoose.Types.ObjectId();
        const eventId = "instagram-mid-101";

        await reserveDmDelivery(creatorId, eventId);
        await markDmDeliverySent(creatorId, eventId, "mid.sent-101");

        const retry = await reserveDmDelivery(creatorId, eventId);
        expect(retry.claimed).toBe(false);
        expect(retry.delivery.status).toBe("sent");
        expect(retry.delivery.messageId).toBe("mid.sent-101");
    });

    it("releases an unsuccessful reservation so the delivery can be retried", async () => {
        const creatorId = new mongoose.Types.ObjectId();
        const eventId = "instagram-mid-102";

        await reserveDmDelivery(creatorId, eventId);
        await releaseDmDelivery(creatorId, eventId);

        const retry = await reserveDmDelivery(creatorId, eventId);
        expect(retry.claimed).toBe(true);
    });

    describe("reservation leases", () => {
        it("refuses to take over a reservation whose lease is still live", async () => {
            const creatorId = new mongoose.Types.ObjectId();
            const eventId = "instagram-mid-200";

            const first = await reserveDmDelivery(creatorId, eventId, { leaseMs: 60000 });
            const second = await reserveDmDelivery(creatorId, eventId);

            expect(first.claimed).toBe(true);
            expect(second.claimed).toBe(false);
            expect(second.delivery.claimId).toBe(first.delivery.claimId);
        });

        it("atomically takes over a reservation whose lease has expired", async () => {
            const creatorId = new mongoose.Types.ObjectId();
            const eventId = "instagram-mid-201";

            const first = await reserveDmDelivery(creatorId, eventId, { leaseMs: 1000 });
            const later = new Date(Date.now() + 5000);

            const takeover = await reserveDmDelivery(creatorId, eventId, { now: later });
            const loser = await reserveDmDelivery(creatorId, eventId, { now: later });

            expect(takeover.claimed).toBe(true);
            expect(takeover.recovered).toBe(true);
            expect(takeover.delivery.claimId).not.toBe(first.delivery.claimId);
            expect(loser.claimed).toBe(false); // the take-over renewed the lease
            expect(await DmDelivery.countDocuments({ creatorId, eventId })).toBe(1);
        });

        it("treats reserved rows without a lease (legacy data) as expired", async () => {
            const creatorId = new mongoose.Types.ObjectId();
            const eventId = "instagram-mid-202";
            await DmDelivery.collection.insertOne({ creatorId, eventId, status: "reserved", messageId: null });

            const result = await reserveDmDelivery(creatorId, eventId);

            expect(result.claimed).toBe(true);
            expect(result.recovered).toBe(true);
        });

        it("never takes over a delivery that was already sent", async () => {
            const creatorId = new mongoose.Types.ObjectId();
            const eventId = "instagram-mid-203";

            await reserveDmDelivery(creatorId, eventId, { leaseMs: 1 });
            await markDmDeliverySent(creatorId, eventId, "mid.sent-203");
            const retry = await reserveDmDelivery(creatorId, eventId, { now: new Date(Date.now() + 60000) });

            expect(retry.claimed).toBe(false);
            expect(retry.delivery.status).toBe("sent");
        });

        it("only lets the current owner release a reservation", async () => {
            const creatorId = new mongoose.Types.ObjectId();
            const eventId = "instagram-mid-204";

            const stale = await reserveDmDelivery(creatorId, eventId, { leaseMs: 1000 });
            const current = await reserveDmDelivery(creatorId, eventId, { now: new Date(Date.now() + 5000) });

            await releaseDmDelivery(creatorId, eventId, stale.delivery.claimId); // stale worker: no effect
            expect(await DmDelivery.countDocuments({ creatorId, eventId })).toBe(1);

            await releaseDmDelivery(creatorId, eventId, current.delivery.claimId);
            expect(await DmDelivery.countDocuments({ creatorId, eventId })).toBe(0);
        });

        it("clears the lease when a delivery is marked as sent", async () => {
            const creatorId = new mongoose.Types.ObjectId();
            const eventId = "instagram-mid-205";

            await reserveDmDelivery(creatorId, eventId);
            await markDmDeliverySent(creatorId, eventId, "mid.sent-205");

            const stored = await DmDelivery.findOne({ creatorId, eventId });
            expect(stored.status).toBe("sent");
            expect(stored.leaseExpiresAt).toBeNull();
        });
    });
});
