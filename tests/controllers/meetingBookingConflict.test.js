const mongoose = require("mongoose");
const User = require("../../model/user");
const EventType = require("../../model/eventType");
const MeetingBooking = require("../../model/meetingBooking");
const GoogleCalendarService = require("../../services/googleCalendarService");
const meetingController = require("../../controller/meetingController");

describe("Meeting Booking Conflict Detection (Issue #1289)", () => {
  let creator;
  let eventType60;
  let eventType30;

  beforeEach(async () => {
    await User.deleteMany({});
    await EventType.deleteMany({});
    await MeetingBooking.deleteMany({});

    creator = await User.create({
      name: "Alex Creator",
      email: "alex@example.com",
      password: "Password123!",
      alias: "alex",
      role: "creator",
    });

    eventType60 = await EventType.create({
      userId: creator._id,
      title: "60 Min Strategy Session",
      slug: "60-min-session",
      duration: 60,
      isActive: true,
      locationType: "google_meet",
    });

    eventType30 = await EventType.create({
      userId: creator._id,
      title: "30 Min Quick Call",
      slug: "30-min-call",
      duration: 30,
      isActive: true,
      locationType: "google_meet",
    });

    jest.spyOn(GoogleCalendarService, "createCalendarEvent").mockResolvedValue({
      meetingLink: "https://meet.google.com/test-meet",
      eventId: "gcal_test_event_123",
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await User.deleteMany({});
    await EventType.deleteMany({});
    await MeetingBooking.deleteMany({});
  });

  function createMockRes() {
    const res = {
      statusCode: 200,
      body: null,
      status: jest.fn(function (code) {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn(function (data) {
        res.body = data;
        return res;
      }),
    };
    return res;
  }

  it("1. should reject booking when an existing meeting completely contains the requested slot", async () => {
    // Existing: 09:00 to 11:00 UTC (2 hours)
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType60._id,
      attendeeName: "Existing Attendee",
      attendeeEmail: "existing@example.com",
      startTime: new Date("2026-10-01T09:00:00.000Z"),
      endTime: new Date("2026-10-01T11:00:00.000Z"),
      status: "scheduled",
    });

    // Requested: 09:30 to 10:30 UTC (60 mins, completely inside 09:00-11:00)
    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: {
        attendeeName: "New Attendee",
        attendeeEmail: "new@example.com",
        startTime: "2026-10-01T09:30:00.000Z",
      },
    };
    const res = createMockRes();

    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no longer available/i);
  });

  it("2. should reject booking when requested booking completely contains an existing meeting", async () => {
    // Existing: 09:30 to 10:00 UTC (30 mins)
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType30._id,
      attendeeName: "Existing Attendee",
      attendeeEmail: "existing@example.com",
      startTime: new Date("2026-10-01T09:30:00.000Z"),
      endTime: new Date("2026-10-01T10:00:00.000Z"),
      status: "scheduled",
    });

    // Requested: 09:00 to 10:00 UTC (60 mins, contains 09:30-10:00)
    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: {
        attendeeName: "New Attendee",
        attendeeEmail: "new@example.com",
        startTime: "2026-10-01T09:00:00.000Z",
      },
    };
    const res = createMockRes();

    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no longer available/i);
  });

  it("3. should reject booking when requested booking starts inside an existing meeting", async () => {
    // Existing: 09:00 to 10:00 UTC
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType60._id,
      attendeeName: "Existing Attendee",
      attendeeEmail: "existing@example.com",
      startTime: new Date("2026-10-01T09:00:00.000Z"),
      endTime: new Date("2026-10-01T10:00:00.000Z"),
      status: "scheduled",
    });

    // Requested: 09:30 to 10:30 UTC
    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: {
        attendeeName: "New Attendee",
        attendeeEmail: "new@example.com",
        startTime: "2026-10-01T09:30:00.000Z",
      },
    };
    const res = createMockRes();

    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.success).toBe(false);
  });

  it("4. should reject booking when requested booking ends inside an existing meeting", async () => {
    // Existing: 09:30 to 10:30 UTC
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType60._id,
      attendeeName: "Existing Attendee",
      attendeeEmail: "existing@example.com",
      startTime: new Date("2026-10-01T09:30:00.000Z"),
      endTime: new Date("2026-10-01T10:30:00.000Z"),
      status: "scheduled",
    });

    // Requested: 09:00 to 10:00 UTC
    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: {
        attendeeName: "New Attendee",
        attendeeEmail: "new@example.com",
        startTime: "2026-10-01T09:00:00.000Z",
      },
    };
    const res = createMockRes();

    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.success).toBe(false);
  });

  it("5. should allow back-to-back bookings with exact boundary match", async () => {
    // Existing: 09:00 to 10:00 UTC
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType60._id,
      attendeeName: "Existing Attendee",
      attendeeEmail: "existing@example.com",
      startTime: new Date("2026-10-01T09:00:00.000Z"),
      endTime: new Date("2026-10-01T10:00:00.000Z"),
      status: "scheduled",
    });

    // Requested: 10:00 to 11:00 UTC (starts exactly when previous ends)
    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: {
        attendeeName: "Back To Back Attendee",
        attendeeEmail: "b2b@example.com",
        startTime: "2026-10-01T10:00:00.000Z",
      },
    };
    const res = createMockRes();

    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.booking).toBeDefined();
  });

  it("6. should allow completely disjoint bookings", async () => {
    // Existing: 09:00 to 10:00 UTC
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType60._id,
      attendeeName: "Existing Attendee",
      attendeeEmail: "existing@example.com",
      startTime: new Date("2026-10-01T09:00:00.000Z"),
      endTime: new Date("2026-10-01T10:00:00.000Z"),
      status: "scheduled",
    });

    // Requested: 11:00 to 12:00 UTC (1 hour gap)
    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: {
        attendeeName: "Disjoint Attendee",
        attendeeEmail: "disjoint@example.com",
        startTime: "2026-10-01T11:00:00.000Z",
      },
    };
    const res = createMockRes();

    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.booking).toBeDefined();
  });

  it("7. should reject a booking that starts inside the window but crosses local midnight", async () => {
    // Default availability is Mon-Fri 09:00-17:00 UTC. 2026-10-01 is a Thursday.
    // 23:30 -> 00:30 used to pass because start and end were compared independently.
    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: {
        attendeeName: "Night Owl",
        attendeeEmail: "night@example.com",
        startTime: "2026-10-01T23:30:00.000Z",
      },
    };
    const res = createMockRes();

    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.message).toMatch(/outside the event availability window/i);
    expect(await MeetingBooking.countDocuments({ userId: creator._id })).toBe(0);
  });

  it("8. should honour bufferAfter when checking for conflicts, like slot generation does", async () => {
    const bufferedType = await EventType.create({
      userId: creator._id,
      title: "Buffered Call",
      slug: "buffered-call",
      duration: 60,
      bufferAfter: 15,
      isActive: true,
      locationType: "google_meet",
    });

    // Existing: 09:00 to 10:00 UTC, so the host is blocked until 10:15
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: bufferedType._id,
      attendeeName: "Existing Attendee",
      attendeeEmail: "existing@example.com",
      startTime: new Date("2026-10-01T09:00:00.000Z"),
      endTime: new Date("2026-10-01T10:00:00.000Z"),
      status: "scheduled",
    });

    const tooSoon = createMockRes();
    await meetingController.createBooking(
      {
        params: { alias: "alex", slug: "buffered-call" },
        body: { attendeeName: "Too Soon", attendeeEmail: "soon@example.com", startTime: "2026-10-01T10:00:00.000Z" },
      },
      tooSoon
    );
    expect(tooSoon.status).toHaveBeenCalledWith(409);
    expect(tooSoon.body.message).toMatch(/no longer available/i);

    const afterBuffer = createMockRes();
    await meetingController.createBooking(
      {
        params: { alias: "alex", slug: "buffered-call" },
        body: { attendeeName: "After Buffer", attendeeEmail: "after@example.com", startTime: "2026-10-01T10:15:00.000Z" },
      },
      afterBuffer
    );
    expect(afterBuffer.status).toHaveBeenCalledWith(201);
  });
});
