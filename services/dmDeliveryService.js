const DmDelivery = require("../model/dmDelivery");

// How long a worker may hold a reservation before another attempt can take it over.
// It must comfortably exceed the Graph API request timeout (15s) so a slow-but-alive worker is
// never taken over, and stay below the total BullMQ retry window (2+4+8+16s = 30s) so a job that
// lost its worker is recovered by one of its own retries instead of being dropped.
const DEFAULT_DM_DELIVERY_LEASE_MS = Number(process.env.DM_DELIVERY_LEASE_MS) || 25 * 1000;

async function reserveDmDelivery(creatorId, eventId, options = {}) {
  if (!creatorId || !eventId) {
    throw new Error("Creator ID and event ID are required for DM delivery state.");
  }

  const now = options.now || new Date();
  const leaseMs = options.leaseMs || DEFAULT_DM_DELIVERY_LEASE_MS;
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  try {
    const delivery = await DmDelivery.create({
      creatorId,
      eventId,
      status: "reserved",
      leaseExpiresAt,
      attempts: 1,
    });

    return { claimed: true, reclaimed: false, delivery };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }
  }

  // Somebody reserved this event before. If that reservation is still `reserved` but its lease
  // has expired, its owner crashed/stalled before sending: take it over atomically (the filter
  // only matches while the lease is expired, so exactly one competing attempt can win).
  // Rows written before leases existed have no leaseExpiresAt and are judged by updatedAt.
  const staleCutoff = new Date(now.getTime() - leaseMs);
  const reclaimed = await DmDelivery.findOneAndUpdate(
    {
      creatorId,
      eventId,
      status: "reserved",
      $or: [
        { leaseExpiresAt: { $lte: now } },
        { leaseExpiresAt: null, updatedAt: { $lte: staleCutoff } },
      ],
    },
    { $set: { leaseExpiresAt }, $inc: { attempts: 1 } },
    { new: true }
  );

  if (reclaimed) {
    return { claimed: true, reclaimed: true, delivery: reclaimed };
  }

  const delivery = await DmDelivery.findOne({ creatorId, eventId });
  if (!delivery) {
    throw new Error("DM delivery reservation could not be recovered after a duplicate claim.");
  }

  return { claimed: false, reclaimed: false, delivery };
}

async function markDmDeliverySent(creatorId, eventId, messageId) {
  await DmDelivery.updateOne(
    { creatorId, eventId },
    {
      $set: {
        status: "sent",
        messageId: messageId || null,
        sentAt: new Date(),
      },
    },
  );
}

async function releaseDmDelivery(creatorId, eventId) {
  await DmDelivery.deleteOne({ creatorId, eventId, status: "reserved" });
}

module.exports = {
  DEFAULT_DM_DELIVERY_LEASE_MS,
  reserveDmDelivery,
  markDmDeliverySent,
  releaseDmDelivery,
};
