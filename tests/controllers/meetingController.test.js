const mongoose = require("mongoose");
const EventType = require("../../model/eventType");
const MeetingBooking = require("../../model/meetingBooking");
const User = require("../../model/user");
const GoogleCalendarService = require("../../services/googleCalendarService");
const meetingController = require("../../controller/meetingController");

describe("Meeting Controller & Google Calendar Service", () => {
  let originalUserFindById;
  let originalUserFindByIdAndUpdate;

  beforeAll(() => {
    originalUserFindById = User.findById;
    originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
  });

  afterEach(() => {
    User.findById = originalUserFindById;
    User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
    jest.restoreAllMocks();
  });

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
    const userId = "60d5ecb8b5c9c22b1c8e1111";

    beforeEach(() => {
      req = {
        user: { id: userId, name: "Alex Creator", alias: "alex" },
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

    it("uses the JWT user id when listing event types", async () => {
      const sort = jest.fn().mockResolvedValue([]);
      const find = jest.spyOn(EventType, "find").mockReturnValue({ sort });

      await meetingController.getEventTypes(req, res);

      expect(find).toHaveBeenCalledWith({ userId });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("uses the JWT user id when creating an event type", async () => {
      const findOne = jest.spyOn(EventType, "findOne").mockResolvedValue(null);
      const createdEventType = { _id: "event-1", userId, title: "Discovery Call" };
      const create = jest.spyOn(EventType, "create").mockResolvedValue(createdEventType);
      req.body = { title: "Discovery Call", duration: 30 };

      await meetingController.createEventType(req, res);

      expect(findOne).toHaveBeenCalledWith({ userId, slug: "discovery-call" });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ userId, title: "Discovery Call", duration: 30 })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("uses the JWT user id when updating an event type", async () => {
      const eventType = { _id: "event-1", userId, title: "Discovery Call" };
      const findOne = jest.spyOn(EventType, "findOne").mockResolvedValue(eventType);
      const findByIdAndUpdate = jest
        .spyOn(EventType, "findByIdAndUpdate")
        .mockResolvedValue({ ...eventType, description: "Updated" });
      req.params = { id: "event-1" };
      req.body = { description: "Updated" };

      await meetingController.updateEventType(req, res);

      expect(findOne).toHaveBeenCalledWith({ _id: "event-1", userId });
      expect(findByIdAndUpdate).toHaveBeenCalledWith(
        "event-1",
        req.body,
        { new: true, runValidators: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("uses the JWT user id when deleting an event type", async () => {
      const findOneAndDelete = jest
        .spyOn(EventType, "findOneAndDelete")
        .mockResolvedValue({ _id: "event-1", userId });
      req.params = { id: "event-1" };

      await meetingController.deleteEventType(req, res);

      expect(findOneAndDelete).toHaveBeenCalledWith({ _id: "event-1", userId });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("uses the JWT user id when listing bookings", async () => {
      const sort = jest.fn().mockResolvedValue([]);
      const populate = jest.fn().mockReturnValue({ sort });
      const find = jest.spyOn(MeetingBooking, "find").mockReturnValue({ populate });

      await meetingController.getUserBookings(req, res);

      expect(find).toHaveBeenCalledWith({ userId });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("uses the JWT user id when cancelling an owned booking", async () => {
      const booking = {
        userId: { toString: () => userId },
        status: "scheduled",
        cancelReason: undefined,
        googleEventId: null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      const findById = jest.spyOn(MeetingBooking, "findById").mockResolvedValue(booking);
      req.params = { id: "booking-1" };
      req.body = { cancelReason: "Schedule change" };

      await meetingController.cancelBooking(req, res);

      expect(findById).toHaveBeenCalledWith("booking-1");
      expect(booking.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("uses the JWT user id for Google Calendar status", async () => {
      const findById = jest.fn().mockResolvedValue({
        googleCalendarTokens: { isConnected: true },
      });
      const original = User.findById;
      User.findById = findById;
      const getAuthUrl = jest
        .spyOn(GoogleCalendarService, "getAuthUrl")
        .mockReturnValue("https://calendar.example/auth");
      jest.spyOn(GoogleCalendarService, "isConfigured").mockReturnValue(true);

      await meetingController.getGoogleCalendarStatus(req, res);

      expect(findById).toHaveBeenCalledWith(userId);
      expect(getAuthUrl).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(200);
      User.findById = original;
    });

    it("uses the JWT user id when connecting Google Calendar", async () => {
      const getAuthUrl = jest
        .spyOn(GoogleCalendarService, "getAuthUrl")
        .mockReturnValue("https://calendar.example/auth");

      await meetingController.connectGoogleCalendar(req, res);

      expect(getAuthUrl).toHaveBeenCalledWith(userId);
      expect(res.redirect).toHaveBeenCalledWith("https://calendar.example/auth");
    });

    it("uses the JWT user id when disconnecting Google Calendar", async () => {
      const findByIdAndUpdate = jest.fn().mockResolvedValue({});
      const original = User.findByIdAndUpdate;
      User.findByIdAndUpdate = findByIdAndUpdate;

      await meetingController.disconnectGoogleCalendar(req, res);

      expect(findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          googleCalendarTokens: expect.objectContaining({ isConnected: false }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      User.findByIdAndUpdate = original;
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

  describe("EventType userId immutability", () => {
    it("marks userId as immutable in the schema", () => {
      const userIdPath = EventType.schema.paths.userId;
      expect(userIdPath).toBeDefined();
      expect(userIdPath.options.immutable).toBe(true);
    });

    it("strips userId and _id from the update payload in updateEventType", async () => {
      const ownerId = new mongoose.Types.ObjectId();
      const attackerId = new mongoose.Types.ObjectId();
      const eventId = new mongoose.Types.ObjectId().toString();

      const mockEventType = { _id: eventId, userId: ownerId, title: "Call" };

      const findOneSpy = jest.spyOn(EventType, "findOne").mockResolvedValue(mockEventType);
      const updateSpy = jest.spyOn(EventType, "findByIdAndUpdate").mockResolvedValue({
        ...mockEventType,
        title: "Updated Call",
      });

      const req = {
        user: { _id: ownerId },
        params: { id: eventId },
        body: { title: "Updated Call", userId: attackerId.toString() },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await meetingController.updateEventType(req, res);

      expect(updateSpy).toHaveBeenCalledWith(
        eventId,
        expect.not.objectContaining({ userId: expect.anything() }),
        expect.any(Object)
      );
      expect(res.status).toHaveBeenCalledWith(200);

      findOneSpy.mockRestore();
      updateSpy.mockRestore();
    });
  });
});
