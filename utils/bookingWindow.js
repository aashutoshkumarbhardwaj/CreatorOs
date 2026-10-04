const { zonedDateTimeToUtc, localDayName, localDateString } = require("./timeZone");

const DEFAULT_DAYS = ["mon", "tue", "wed", "thu", "fri"];
const MINUTE_MS = 60 * 1000;

/**
 * Decide whether a requested booking [start, end) fits inside the host's
 * availability window.
 *
 * The window is anchored to the host's *local calendar day of the start time*
 * and converted to absolute UTC instants (DST-safe). The whole booking must fit
 * between those two instants, so a booking that starts inside the window but
 * runs past the end of it - including one that crosses local midnight - is
 * rejected. This is the same definition of "available" that
 * availabilityController.getAvailableSlots uses to generate slots.
 *
 * @returns {{ok: true} | {ok: false, status: number, message: string}}
 */
function checkAvailabilityWindow({ start, end, availability }) {
  const config = availability || {};
  const timeZone = config.timeZone || "UTC";
  const allowedDays = config.days || DEFAULT_DAYS;

  let localDate;
  try {
    localDate = localDateString(start, timeZone);
  } catch (error) {
    return { ok: false, status: 400, message: "Event availability timezone is invalid" };
  }

  const windowStart = zonedDateTimeToUtc(localDate, config.startTime || "09:00", timeZone);
  const windowEnd = zonedDateTimeToUtc(localDate, config.endTime || "17:00", timeZone);

  if (!windowStart || !windowEnd || windowEnd <= windowStart) {
    return { ok: false, status: 400, message: "Invalid availability timezone or time range" };
  }

  if (!allowedDays.includes(localDayName(localDate)) || start < windowStart || end > windowEnd) {
    return { ok: false, status: 409, message: "This time is outside the event availability window" };
  }

  return { ok: true };
}

/**
 * Range used to look up existing bookings that conflict with [start, end),
 * honouring the event type's buffers exactly like slot generation does:
 *   slotStart < booking.end + bufferAfter  &&  slotEnd > booking.start - bufferBefore
 * rewritten as a query on the existing booking's own start/end.
 */
function getConflictRange({ start, end, bufferBefore = 0, bufferAfter = 0 }) {
  return {
    startTime: { $lt: new Date(end.getTime() + (Number(bufferBefore) || 0) * MINUTE_MS) },
    endTime: { $gt: new Date(start.getTime() - (Number(bufferAfter) || 0) * MINUTE_MS) },
  };
}

module.exports = { checkAvailabilityWindow, getConflictRange };
