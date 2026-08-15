const EventType = require("../model/eventType");
const MeetingBooking = require("../model/meetingBooking");
const User = require("../model/user");
const GoogleCalendarService = require("../services/googleCalendarService");

/**
 * Helper to slugify string titles.
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

/**
 * Helper to find creator user by alias or ID or name slug.
 */
async function findCreatorByAliasOrName(identifier) {
  let creator = await User.findOne({ alias: identifier });
  if (!creator) {
    const users = await User.find({ role: "creator" });
    creator = users.find((u) => slugify(u.name) === identifier.toLowerCase() || u.alias === identifier);
  }
  if (!creator && identifier.match(/^[0-9a-fA-F]{24}$/)) {
    creator = await User.findById(identifier);
  }
  return creator;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD EVENT TYPE CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

exports.getEventTypes = async (req, res) => {
  try {
    const eventTypes = await EventType.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: eventTypes.length, data: eventTypes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEventType = async (req, res) => {
  try {
    const { title, description, duration, locationType, locationDetails, price, currency, color, availability, bufferBefore, bufferAfter, customQuestions } = req.body;

    if (!title || !duration) {
      return res.status(400).json({ success: false, message: "Title and duration are required" });
    }

    let baseSlug = slugify(title);
    if (!baseSlug) baseSlug = "meeting";

    let slug = baseSlug;
    let count = 1;
    while (await EventType.findOne({ userId: req.user._id, slug })) {
      slug = `${baseSlug}-${count++}`;
    }

    const eventType = await EventType.create({
      userId: req.user._id,
      title,
      slug,
      description: description || "",
      duration: Number(duration),
      locationType: locationType || "google_meet",
      locationDetails: locationDetails || "",
      price: price ? Number(price) : 0,
      currency: currency || "USD",
      color: color || "#6366f1",
      availability: availability || {
        days: ["mon", "tue", "wed", "thu", "fri"],
        startTime: "09:00",
        endTime: "17:00",
        timeZone: "UTC",
      },
      bufferBefore: bufferBefore ? Number(bufferBefore) : 0,
      bufferAfter: bufferAfter ? Number(bufferAfter) : 0,
      customQuestions: customQuestions || [],
    });

    return res.status(201).json({ success: true, data: eventType });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEventType = async (req, res) => {
  try {
    const { id } = req.params;
    let eventType = await EventType.findOne({ _id: id, userId: req.user._id });

    if (!eventType) {
      return res.status(404).json({ success: false, message: "Event type not found" });
    }

    if (req.body.title && req.body.title !== eventType.title) {
      let baseSlug = slugify(req.body.title);
      let slug = baseSlug;
      let count = 1;
      while (await EventType.findOne({ userId: req.user._id, slug, _id: { $ne: id } })) {
        slug = `${baseSlug}-${count++}`;
      }
      req.body.slug = slug;
    }

    eventType = await EventType.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    return res.status(200).json({ success: true, data: eventType });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteEventType = async (req, res) => {
  try {
    const { id } = req.params;
    const eventType = await EventType.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!eventType) {
      return res.status(404).json({ success: false, message: "Event type not found" });
    }

    return res.status(200).json({ success: true, message: "Event type deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD BOOKINGS & CALENDAR CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await MeetingBooking.find({ userId: req.user._id })
      .populate("eventTypeId", "title duration color price locationType")
      .sort({ startTime: 1 });

    const now = new Date();
    const upcoming = bookings.filter((b) => b.endTime >= now && b.status === "scheduled");
    const past = bookings.filter((b) => b.endTime < now || b.status !== "scheduled");

    return res.status(200).json({
      success: true,
      upcoming,
      past,
      all: bookings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancelReason } = req.body;

    const booking = await MeetingBooking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check ownership if requested by logged in user
    if (req.user && booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to cancel this booking" });
    }

    booking.status = "cancelled";
    booking.cancelReason = cancelReason || "Cancelled by host/attendee";
    await booking.save();

    const host = await User.findById(booking.userId);
    if (host && booking.googleEventId) {
      await GoogleCalendarService.deleteCalendarEvent(host, booking.googleEventId);
    }

    return res.status(200).json({ success: true, message: "Booking cancelled", data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGoogleCalendarStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const tokens = user.googleCalendarTokens || {};
    const authUrl = GoogleCalendarService.getAuthUrl(req.user._id.toString());

    return res.status(200).json({
      success: true,
      isConnected: Boolean(tokens.isConnected),
      authUrl,
      isConfigured: GoogleCalendarService.isConfigured(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.connectGoogleCalendar = async (req, res) => {
  try {
    const authUrl = GoogleCalendarService.getAuthUrl(req.user._id.toString());
    if (authUrl) {
      return res.redirect(authUrl);
    }
    // If not configured, activate mock connection directly
    await GoogleCalendarService.handleCallback("mock_code", req.user._id.toString());
    return res.redirect("/services/meetings?googleConnected=1");
  } catch (error) {
    return res.redirect("/services/meetings?error=" + encodeURIComponent(error.message));
  }
};

exports.googleCalendarCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state || req.user?._id?.toString();

    if (!userId) {
      return res.redirect("/login");
    }

    await GoogleCalendarService.handleCallback(code || "mock_code", userId);
    return res.redirect("/services/meetings?googleConnected=1");
  } catch (error) {
    return res.redirect("/services/meetings?error=" + encodeURIComponent(error.message));
  }
};

exports.disconnectGoogleCalendar = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      googleCalendarTokens: {
        accessToken: null,
        refreshToken: null,
        expiryDate: null,
        calendarId: "primary",
        isConnected: false,
      },
    });
    return res.status(200).json({ success: true, message: "Google Calendar disconnected" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC BOOKING CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

exports.getPublicBookingData = async (req, res) => {
  try {
    const { alias, slug } = req.params;

    const creator = await findCreatorByAliasOrName(alias);
    if (!creator) {
      return res.status(404).json({ success: false, message: "Creator not found" });
    }

    const eventType = await EventType.findOne({ userId: creator._id, slug, isActive: true });
    if (!eventType) {
      return res.status(404).json({ success: false, message: "Event type not found or inactive" });
    }

    return res.status(200).json({
      success: true,
      creator: {
        id: creator._id,
        name: creator.name,
        alias: creator.alias || slugify(creator.name),
        avatar: creator.avatar,
        bio: creator.bio,
      },
      eventType,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAvailableSlots = async (req, res) => {
  try {
    const { alias, slug } = req.params;
    const { date } = req.query; // YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ success: false, message: "Date query parameter is required (YYYY-MM-DD)" });
    }

    const creator = await findCreatorByAliasOrName(alias);
    if (!creator) {
      return res.status(404).json({ success: false, message: "Creator not found" });
    }

    const eventType = await EventType.findOne({ userId: creator._id, slug, isActive: true });
    if (!eventType) {
      return res.status(404).json({ success: false, message: "Event type not found" });
    }

    const targetDate = new Date(`${date}T00:00:00.000Z`);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    // Check day of week
    const daysMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayName = daysMap[targetDate.getUTCDay()];

    const allowedDays = eventType.availability?.days || ["mon", "tue", "wed", "thu", "fri"];
    if (!allowedDays.includes(dayName)) {
      return res.status(200).json({ success: true, slots: [], message: "Host is not available on this day" });
    }

    // Parse start and end time (HH:MM)
    const [startH, startM] = (eventType.availability?.startTime || "09:00").split(":").map(Number);
    const [endH, endM] = (eventType.availability?.endTime || "17:00").split(":").map(Number);

    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(startH, startM, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(endH, endM, 0, 0);

    const durationMs = eventType.duration * 60 * 1000;
    const bufferBeforeMs = (eventType.bufferBefore || 0) * 60 * 1000;
    const bufferAfterMs = (eventType.bufferAfter || 0) * 60 * 1000;

    // Fetch existing bookings for creator on target date
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existingBookings = await MeetingBooking.find({
      userId: creator._id,
      status: "scheduled",
      startTime: { $gte: startOfDay, $lte: endOfDay },
    });

    const now = new Date();
    const candidateSlots = [];
    let currentSlotStart = new Date(dayStart);

    while (currentSlotStart.getTime() + durationMs <= dayEnd.getTime()) {
      const slotEnd = new Date(currentSlotStart.getTime() + durationMs);

      // Check if slot is in the past
      if (currentSlotStart > now) {
        // Check overlap with existing bookings
        const isOverlapping = existingBookings.some((b) => {
          const bStartWithBuffer = new Date(b.startTime.getTime() - bufferBeforeMs);
          const bEndWithBuffer = new Date(b.endTime.getTime() + bufferAfterMs);
          return currentSlotStart < bEndWithBuffer && slotEnd > bStartWithBuffer;
        });

        if (!isOverlapping) {
          const timeStr = currentSlotStart.toISOString().substring(11, 16);
          candidateSlots.push({
            startTime: currentSlotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            formattedTime: timeStr,
          });
        }
      }

      // Step by duration (or 30 mins interval)
      currentSlotStart = new Date(currentSlotStart.getTime() + durationMs);
    }

    return res.status(200).json({ success: true, date, slots: candidateSlots });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const { alias, slug } = req.params;
    const { attendeeName, attendeeEmail, attendeeNotes, startTime, timeZone, answers } = req.body;

    if (!attendeeName || !attendeeEmail || !startTime) {
      return res.status(400).json({ success: false, message: "Name, email, and start time are required" });
    }

    const creator = await findCreatorByAliasOrName(alias);
    if (!creator) {
      return res.status(404).json({ success: false, message: "Creator not found" });
    }

    const eventType = await EventType.findOne({ userId: creator._id, slug, isActive: true });
    if (!eventType) {
      return res.status(404).json({ success: false, message: "Event type not found" });
    }

    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid start time" });
    }

    const end = new Date(start.getTime() + eventType.duration * 60 * 1000);

    // Conflict check
    const existingConflict = await MeetingBooking.findOne({
      userId: creator._id,
      status: "scheduled",
      $or: [
        { startTime: { $lt: end, $gte: start } },
        { endTime: { $gt: start, $lte: end } },
      ],
    });

    if (existingConflict) {
      return res.status(409).json({ success: false, message: "This time slot is no longer available. Please select another slot." });
    }

    // Sync with Google Calendar service
    const gCalResult = await GoogleCalendarService.createCalendarEvent(creator, {
      title: `${eventType.title} with ${attendeeName}`,
      description: `Meeting arranged via CreatorOS\n\nNotes: ${attendeeNotes || "None"}`,
      startTime: start,
      endTime: end,
      attendeeName,
      attendeeEmail,
      locationType: eventType.locationType,
      locationDetails: eventType.locationDetails,
    });

    const booking = await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType._id,
      attendeeName,
      attendeeEmail,
      attendeeNotes: attendeeNotes || "",
      answers: answers || [],
      startTime: start,
      endTime: end,
      timeZone: timeZone || "UTC",
      status: "scheduled",
      locationType: eventType.locationType,
      meetingLink: gCalResult.meetingLink,
      googleEventId: gCalResult.eventId,
    });

    return res.status(201).json({
      success: true,
      message: "Booking confirmed successfully!",
      booking: {
        id: booking._id,
        attendeeName: booking.attendeeName,
        attendeeEmail: booking.attendeeEmail,
        startTime: booking.startTime,
        endTime: booking.endTime,
        meetingLink: booking.meetingLink,
        eventTitle: eventType.title,
        hostName: creator.name,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
