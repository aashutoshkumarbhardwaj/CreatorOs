const EventType = require("../../model/eventType");
const MeetingBooking = require("../../model/meetingBooking");
const User = require("../../model/user");
const GoogleCalendarService = require("../../services/googleCalendarService");
const meetingController = require("../../controller/meetingController");

describe("Meeting Controller & Google Calendar Service", () => {

  describe("GoogleCalendarService", () => {
    it("should return false for isConfigured when env vars are missing", () => {
      const originalClientId = process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;

      expect(GoogleCalendarService.isConfigured()).toBe(false);

      process.env.GOOGLE_CLIENT_ID = originalClientId;
    });

    it("should generate mock calendar event and meet link when not connected", async () => {
      const mockUser = {
        email: "host@example.com",
        name: "Host User",
        googleCalendarTokens: { isConnected: false },
      };

      const bookingDetails = {
        title: "30 Min Discovery Call",
        description: "Initial Chat",
        startTime: new Date("2026-09-01T10:00:00.000Z"),
        endTime: new Date("2026-09-01T10:30:00.000Z"),
        attendeeName: "Jane Doe",
        attendeeEmail: "jane@example.com",
        locationType: "google_meet",
      };

      const result = await GoogleCalendarService.createCalendarEvent(mockUser, bookingDetails);

      expect(result.eventId).toBeDefined();
      expect(result.meetingLink).toMatch(/^https:\/\/meet\.google\.com\//);
      expect(result.isMock).toBe(true);
    });
  });

  describe("Meeting Controller Unit Logic", () => {
    let req, res;

    beforeEach(() => {
      req = {
        user: { _id: "60d5ecb8b5c9c22b1c8e1111", name: "Alex Creator", alias: "alex" },
        body: {},
        params: {},
        query: {},
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis(),
      };
    });

    it("should reject createEventType if title or duration is missing", async () => {
      req.body = { description: "Missing title and duration" };
      await meetingController.createEventType(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringMatching(/required/i) })
      );
    });

    it("should reject getAvailableSlots if date parameter is missing", async () => {
      req.params = { alias: "alex", slug: "30-min-call" };
      req.query = {}; // missing date

      await meetingController.getAvailableSlots(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringMatching(/Date query parameter is required/i) })
      );
    });

    it("should reject createBooking if required attendee details are missing", async () => {
      req.params = { alias: "alex", slug: "30-min-call" };
      req.body = { attendeeName: "John" }; // missing attendeeEmail and startTime

      await meetingController.createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringMatching(/required/i) })
      );
    });
  });
});
