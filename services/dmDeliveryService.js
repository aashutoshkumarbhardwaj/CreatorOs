const crypto = require("crypto");
const DmDelivery = require("../model/dmDelivery");

// A reservation is a lease. It must outlive one delivery attempt (outbound request
// timeout is 15s, plus database round trips) so a healthy worker never loses it,
// but expire soon enough for a BullMQ retry (exponential backoff: 2s, 4s, 8s, 16s)
// to recover the delivery after a crashed or stalled worker.
const DEFAULT_DM_LEASE_MS = Number(process.env.DM_DELIVERY_LEASE_MS) || 30 * 1000;
const MAX_RESERVE_ATTEMPTS = 3;

/**
 * Try to become the one worker allowed to send the reply for (creatorId, eventId).
 *
 * - No row yet: create it with a fresh lease -> { claimed: true }.
 * - Row is "sent": nothing to do -> { claimed: false, delivery }.
 * - Row is "reserved" with a LIVE lease: another worker is on it -> { claimed: false, delivery }.
 * - Row is "reserved" with an EXPIRED (or missing) lease: its owner is presumed dead.
 *   Take it over atomically -> { claimed: true, recovered: true }.
 */
async function reserveDmDelivery(creatorId, eventId, options = {}) {
  if (!creatorId || !eventId) {
    throw new Error("Creator ID and event ID are required for DM delivery state.");
  }

  const leaseMs = options.leaseMs ?? DEFAULT_DM_LEASE_MS;

  for (let attempt = 0; attempt < MAX_RESERVE_ATTEMPTS; attempt++) {
    const now = options.now || new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const claimId = crypto.randomUUID();

    try {
      const delivery = await DmDelivery.create({
        creatorId,
        eventId,
        status: "reserved",
        claimId,
        leaseExpiresAt,
      });

      return { claimed: true, recovered: false, delivery };
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }

    // `leaseExpiresAt: null` also matches rows that predate the field.
    const recovered = await DmDelivery.findOneAndUpdate(
      {
        creatorId,
        eventId,
        status: "reserved",
        $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lte: now } }],
      },
      { $set: { claimId, leaseExpiresAt } },
      { new: true },
    );

    if (recovered) {
      return { claimed: true, recovered: true, delivery: recovered };
    }

    const delivery = await DmDelivery.findOne({ creatorId, eventId });
    if (delivery) {
      return { claimed: false, delivery };
    }

    // The row was released between our insert and our lookup; try to claim again.
  }

  throw new Error("DM delivery reservation could not be acquired after repeated contention.");
}

/**
 * Record that the DM went out. Deliberately not fenced by claimId: if a message
 * was sent, "sent" is a fact regardless of which attempt owns the lease, and
 * recording it stops later retries from sending it again.
 */
async function markDmDeliverySent(creatorId, eventId, messageId) {
  await DmDelivery.updateOne(
    { creatorId, eventId },
    {
      $set: {
        status: "sent",
        messageId: messageId || null,
        leaseExpiresAt: null,
      },
    },
  );
}

/**
 * Give the reservation back after a send that definitely did not happen.
 * When claimId is supplied, only the attempt that still owns the reservation
 * can release it, so a stale worker cannot delete a newer owner's lease.
 */
async function releaseDmDelivery(creatorId, eventId, claimId) {
  const filter = { creatorId, eventId, status: "reserved" };
  if (claimId) {
    filter.claimId = claimId;
  }

  await DmDelivery.deleteOne(filter);
}

module.exports = {
  reserveDmDelivery,
  markDmDeliverySent,
  releaseDmDelivery,
  DEFAULT_DM_LEASE_MS,
};
