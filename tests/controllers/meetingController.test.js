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

      if (originalClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
      } else {
        process.env.GOOGLE_CLIENT_ID = originalClientId;
      }
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

    it("should propagate a Google Calendar API error instead of fabricating a mock event", async () => {
      const originalEnv = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL,
      };
      const originalFetch = global.fetch;

      process.env.GOOGLE_CLIENT_ID = "client-id";
      process.env.GOOGLE_CLIENT_SECRET = "client-secret";
      process.env.GOOGLE_CALENDAR_REDIRECT_URI = "http://localhost:3000/api/meetings/google/callback";
      delete process.env.GOOGLE_CALLBACK_URL;

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "The caller does not have permission" } }),
      });

      const mockUser = {
        email: "host@example.com",
        name: "Host User",
        googleCalendarTokens: {
          isConnected: true,
          accessToken: "real_access_token",
        },
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

      await expect(
        GoogleCalendarService.createCalendarEvent(mockUser, bookingDetails)
      ).rejects.toMatchObject({
        code: "GOOGLE_CALENDAR_API_ERROR",
        status: 403,
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      global.fetch = originalFetch;
      if (originalEnv.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = originalEnv.clientId;
      if (originalEnv.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = originalEnv.clientSecret;
      if (originalEnv.redirectUri === undefined) delete process.env.GOOGLE_CALENDAR_REDIRECT_URI;
      else process.env.GOOGLE_CALENDAR_REDIRECT_URI = originalEnv.redirectUri;
      if (originalEnv.callbackUrl === undefined) delete process.env.GOOGLE_CALLBACK_URL;
      else process.env.GOOGLE_CALLBACK_URL = originalEnv.callbackUrl;
    });

    it("should propagate network failures instead of fabricating a mock event", async () => {
      const originalEnv = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL,
      };
      const originalFetch = global.fetch;
      const networkError = new Error("network unavailable");

      process.env.GOOGLE_CLIENT_ID = "client-id";
      process.env.GOOGLE_CLIENT_SECRET = "client-secret";
      process.env.GOOGLE_CALENDAR_REDIRECT_URI = "http://localhost:3000/api/meetings/google/callback";
      delete process.env.GOOGLE_CALLBACK_URL;
      global.fetch = jest.fn().mockRejectedValue(networkError);

      const mockUser = {
        email: "host@example.com",
        name: "Host User",
        googleCalendarTokens: {
          isConnected: true,
          accessToken: "real_access_token",
        },
      };

      await expect(
        GoogleCalendarService.createCalendarEvent(mockUser, {
          title: "30 Min Discovery Call",
          startTime: new Date("2026-09-01T10:00:00.000Z"),
          endTime: new Date("2026-09-01T10:30:00.000Z"),
          attendeeName: "Jane Doe",
          attendeeEmail: "jane@example.com",
          locationType: "google_meet",
        })
      ).rejects.toBe(networkError);

      global.fetch = originalFetch;
      if (originalEnv.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = originalEnv.clientId;
      if (originalEnv.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = originalEnv.clientSecret;
      if (originalEnv.redirectUri === undefined) delete process.env.GOOGLE_CALENDAR_REDIRECT_URI;
      else process.env.GOOGLE_CALENDAR_REDIRECT_URI = originalEnv.redirectUri;
      if (originalEnv.callbackUrl === undefined) delete process.env.GOOGLE_CALLBACK_URL;
      else process.env.GOOGLE_CALLBACK_URL = originalEnv.callbackUrl;
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
      req.query = {};

      await meetingController.getAvailableSlots(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringMatching(/Date query parameter is required/i) })
      );
    });

    it("should reject createBooking if required attendee details are missing", async () => {
      req.params = { alias: "alex", slug: "30-min-call" };
      req.body = { attendeeName: "John" };

      await meetingController.createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringMatching(/required/i) })
      );
    });

    it("should not persist a booking when Google Calendar event creation fails", async () => {
      const creator = {
        _id: "60d5ecb8b5c9c22b1c8e2222",
        name: "Alex Creator",
        email: "alex@example.com",
        alias: "alex",
      };
      const eventType = {
        _id: "60d5ecb8b5c9c22b1c8e3333",
        title: "30 Min Discovery Call",
        duration: 30,
        locationType: "google_meet",
        locationDetails: "",
      };
      const providerError = Object.assign(new Error("Google Calendar unavailable"), {
        code: "GOOGLE_CALENDAR_API_ERROR",
        status: 503,
      });

      req.params = { alias: "alex", slug: "30-min-call" };
      req.body = {
        attendeeName: "Jane Doe",
        attendeeEmail: "jane@example.com",
        startTime: "2026-09-20T10:00:00.000Z",
      };

      const originalFindOneUser = User.findOne;
      const originalFindOneEventType = EventType.findOne;
      const originalFindOneBooking = MeetingBooking.findOne;
      const originalCreateBooking = MeetingBooking.create;
      const originalCreateCalendarEvent = GoogleCalendarService.createCalendarEvent;

      User.findOne = jest.fn().mockResolvedValue(creator);
      EventType.findOne = jest.fn()
        .mockResolvedValueOnce(eventType)
        .mockResolvedValueOnce(null);
      MeetingBooking.findOne = jest.fn().mockResolvedValue(null);
      MeetingBooking.create = jest.fn();
      GoogleCalendarService.createCalendarEvent = jest.fn().mockRejectedValue(providerError);

      await meetingController.createBooking(req, res);

      expect(GoogleCalendarService.createCalendarEvent).toHaveBeenCalledTimes(1);
      expect(MeetingBooking.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Google Calendar unavailable",
        })
      );

      User.findOne = originalFindOneUser;
      EventType.findOne = originalFindOneEventType;
      MeetingBooking.findOne = originalFindOneBooking;
      MeetingBooking.create = originalCreateBooking;
      GoogleCalendarService.createCalendarEvent = originalCreateCalendarEvent;
    });
  });
});
