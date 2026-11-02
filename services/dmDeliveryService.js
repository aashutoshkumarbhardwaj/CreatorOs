const DmDelivery = require("../model/dmDelivery");

async function reserveDmDelivery(creatorId, eventId) {
  if (!creatorId || !eventId) {
    throw new Error("Creator ID and event ID are required for DM delivery state.");
  }

  try {
    const delivery = await DmDelivery.create({
      creatorId,
      eventId,
      status: "reserved",
    });

    return { claimed: true, delivery };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const delivery = await DmDelivery.findOne({ creatorId, eventId });
    if (!delivery) {
      throw new Error("DM delivery reservation could not be recovered after a duplicate claim.");
    }

    return { claimed: false, delivery };
  }
}

async function markDmDeliverySent(creatorId, eventId, messageId) {
  await DmDelivery.updateOne(
    { creatorId, eventId },
    {
      $set: {
        status: "sent",
        messageId: messageId || null,
      },
    },
  );
}

async function releaseDmDelivery(creatorId, eventId) {
  await DmDelivery.deleteOne({ creatorId, eventId, status: "reserved" });
}

module.exports = {
  reserveDmDelivery,
  markDmDeliverySent,
  releaseDmDelivery,
};
