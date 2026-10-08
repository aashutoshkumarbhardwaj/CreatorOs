/**
 * Shared booking-conflict rules used by BOTH the slot listing endpoint and the
 * booking endpoint, so a slot that is offered can always be booked and a slot
 * that is hidden can never be booked by calling the API directly.
 */

// A `pending_sync` booking is an in-flight reservation (Google Calendar call not
// finished yet). It blocks the time range only while fresh, so a crashed request
// cannot hold a slot hostage forever.
const PENDING_SYNC_TTL_MS = Number(process.env.PENDING_SYNC_TTL_MS) || 2 * 60 * 1000;

/**
 * Builds the Mongo filter matching bookings that block [start, end), honouring the
 * event type's buffers exactly like the slot listing does:
 *   start < existing.end + bufferAfter  &&  end > existing.start - bufferBefore
 */
function buildBlockingBookingQuery({
  userId,
  start,
  end,
  bufferBeforeMs = 0,
  bufferAfterMs = 0,
  excludeId = null,
  pendingBeforeId = null,
  now = new Date(),
}) {
  const pendingClause = {
    status: "pending_sync",
    createdAt: { $gte: new Date(now.getTime() - PENDING_SYNC_TTL_MS) },
  };
  // Race tie-break: a competing in-flight reservation only counts if it sorts BEFORE ours.
  if (pendingBeforeId) pendingClause._id = { $lt: pendingBeforeId };

  const query = {
    userId,
    startTime: { $lt: new Date(end.getTime() + bufferBeforeMs) },
    endTime: { $gt: new Date(start.getTime() - bufferAfterMs) },
    $or: [{ status: "scheduled" }, pendingClause],
  };
  if (excludeId) query._id = { $ne: excludeId };
  return query;
}

/**
 * Deterministic tie-break for two requests that both passed the pre-check (e.g. the
 * distributed lock expired mid-request). The booking whose _id sorts first wins; a
 * confirmed (`scheduled`) rival always wins. Returns true when `booking` must back off.
 * Uses one findOne so the check is a single indexed lookup.
 */
async function lostBookingRace(MeetingBooking, booking, params) {
  const rival = await MeetingBooking.findOne(
    buildBlockingBookingQuery({
      ...params,
      excludeId: booking._id,
      pendingBeforeId: booking._id,
    })
  );
  return Boolean(rival);
}

module.exports = { PENDING_SYNC_TTL_MS, buildBlockingBookingQuery, lostBookingRace };
