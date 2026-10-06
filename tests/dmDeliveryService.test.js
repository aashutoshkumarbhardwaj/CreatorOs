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
});
