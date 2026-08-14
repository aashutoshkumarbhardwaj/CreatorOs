const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getEventTypes,
  createEventType,
  updateEventType,
  deleteEventType,
  getUserBookings,
  cancelBooking,
  getGoogleCalendarStatus,
  connectGoogleCalendar,
  googleCalendarCallback,
  disconnectGoogleCalendar,
  getPublicBookingData,
  getAvailableSlots,
  createBooking,
} = require("../controller/meetingController");

const {
  validateEventType,
  validateCreateBooking,
} = require("../middleware/validators/meetingValidator");

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC BOOKING ROUTES (No Auth Required)
// ─────────────────────────────────────────────────────────────────────────────

// Page View
router.get("/book/:alias/:slug", (req, res) => {
  res.render("public-booking", {
    alias: req.params.alias,
    slug: req.params.slug,
  });
});

// Public APIs
router.get("/api/public/meetings/:alias/:slug", getPublicBookingData);
router.get("/api/public/meetings/:alias/:slug/slots", getAvailableSlots);
router.post("/api/public/meetings/:alias/:slug/book", validateCreateBooking, createBooking);

// ─────────────────────────────────────────────────────────────────────────────
// CREATOR DASHBOARD ROUTES (Protected)
// ─────────────────────────────────────────────────────────────────────────────

// Page View
router.get("/services/meetings", protect, (req, res) => {
  res.render("booking-dashboard", {
    activeNav: "meetings",
    user: req.user,
  });
});

// Event Types API
router.get("/api/meetings/event-types", protect, getEventTypes);
router.post("/api/meetings/event-types", protect, validateEventType, createEventType);
router.put("/api/meetings/event-types/:id", protect, validateEventType, updateEventType);
router.delete("/api/meetings/event-types/:id", protect, deleteEventType);

// Bookings API
router.get("/api/meetings/bookings", protect, getUserBookings);
router.post("/api/meetings/bookings/:id/cancel", protect, cancelBooking);

// Google Calendar Sync API
router.get("/api/meetings/google/status", protect, getGoogleCalendarStatus);
router.get("/api/meetings/google/connect", protect, connectGoogleCalendar);
router.get("/api/meetings/google/callback", googleCalendarCallback);
router.post("/api/meetings/google/disconnect", protect, disconnectGoogleCalendar);

module.exports = router;
