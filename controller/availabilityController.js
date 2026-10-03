const EventType = require("../model/eventType");
const MeetingBooking = require("../model/meetingBooking");
const User = require("../model/user");
const {
  parseDateParts,
  zonedDateTimeToUtc,
  localDayName,
  formatTimeInZone,
} = require("../utils/timeZone");

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

async function findCreatorByAliasOrName(identifier) {
  let creator = await User.findOne({
    $or: [
      { alias: identifier },
      { nameSlug: identifier.toLowerCase() }
    ],
    role: "creator"
  });

  // Graceful fallback for legacy users without a nameSlug
  if (!creator) {
    creator = await User.findOne({
      name: { $regex: new RegExp("^" + identifier.replace(/-/g, '.*') + "$", "i") },
      role: "creator"
    });
  }

  if (!creator && identifier.match(/^[0-9a-fA-F]{24}$/)) {
    creator = await User.findById(identifier);
  }
  return creator;
}

exports.getAvailableSlots = async (req, res) => {
  try {
    const { alias, slug } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: "Date query parameter is required (YYYY-MM-DD)" });
    }
    if (!parseDateParts(date)) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    const creator = await findCreatorByAliasOrName(alias);
    if (!creator) {
      return res.status(404).json({ success: false, message: "Creator not found" });
    }

    const eventType = await EventType.findOne({ userId: creator._id, slug, isActive: true });
    if (!eventType) {
      return res.status(404).json({ success: false, message: "Event type not found" });
    }

    const availability = eventType.availability || {};
    const timeZone = availability.timeZone || "UTC";
    const dayName = localDayName(date);
    const allowedDays = availability.days || ["mon", "tue", "wed", "thu", "fri"];

    if (!allowedDays.includes(dayName)) {
      return res.status(200).json({ success: true, slots: [], message: "Host is not available on this day" });
    }

    const dayStart = zonedDateTimeToUtc(date, availability.startTime || "09:00", timeZone);
    const dayEnd = zonedDateTimeToUtc(date, availability.endTime || "17:00", timeZone);
    const startOfDay = zonedDateTimeToUtc(date, "00:00", timeZone);

    const nextDate = new Date(`${date}T12:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextDateString = nextDate.toISOString().slice(0, 10);
    const startOfNextDay = zonedDateTimeToUtc(nextDateString, "00:00", timeZone);

    if (!dayStart || !dayEnd || !startOfDay || !startOfNextDay || dayEnd <= dayStart) {
      return res.status(400).json({ success: false, message: "Invalid availability timezone or time range" });
    }

    const durationMs = eventType.duration * 60 * 1000;
    const bufferBeforeMs = (eventType.bufferBefore || 0) * 60 * 1000;
    const bufferAfterMs = (eventType.bufferAfter || 0) * 60 * 1000;

    const existingBookings = await MeetingBooking.find({
      userId: creator._id,
      status: "scheduled",
      startTime: { $gte: startOfDay, $lt: startOfNextDay },
    }).lean();

    const now = new Date();
    const candidateSlots = [];
    let currentSlotStart = new Date(dayStart);

    while (currentSlotStart.getTime() + durationMs <= dayEnd.getTime()) {
      const slotEnd = new Date(currentSlotStart.getTime() + durationMs);

      if (currentSlotStart > now) {
        const isOverlapping = existingBookings.some((booking) => {
          const bookingStartWithBuffer = new Date(booking.startTime.getTime() - bufferBeforeMs);
          const bookingEndWithBuffer = new Date(booking.endTime.getTime() + bufferAfterMs);
          return currentSlotStart < bookingEndWithBuffer && slotEnd > bookingStartWithBuffer;
        });

        if (!isOverlapping) {
          candidateSlots.push({
            startTime: currentSlotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            formattedTime: formatTimeInZone(currentSlotStart, timeZone),
          });
        }
      }

      currentSlotStart = new Date(currentSlotStart.getTime() + durationMs);
    }

    return res.status(200).json({ success: true, date, timeZone, slots: candidateSlots });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

