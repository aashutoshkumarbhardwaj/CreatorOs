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

  it("7. should reject a booking that violates the event type buffer (matches slot list rules)", async () => {
    await EventType.updateOne({ _id: eventType60._id }, { $set: { bufferBefore: 15, bufferAfter: 15 } });
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType60._id,
      attendeeName: "Existing Attendee",
      attendeeEmail: "existing@example.com",
      startTime: new Date("2026-10-01T09:00:00.000Z"),
      endTime: new Date("2026-10-01T10:00:00.000Z"),
      status: "scheduled",
    });

    // Starts 5 minutes after the existing meeting ends: inside the 15 minute buffer.
    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: { attendeeName: "New", attendeeEmail: "new@example.com", startTime: "2026-10-01T10:05:00.000Z" },
    };
    const res = createMockRes();
    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.message).toMatch(/no longer available/i);
  });

  it("8. should treat a fresh in-flight (pending_sync) booking as a conflict", async () => {
    await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType60._id,
      attendeeName: "In Flight",
      attendeeEmail: "inflight@example.com",
      startTime: new Date("2026-10-01T09:00:00.000Z"),
      endTime: new Date("2026-10-01T10:00:00.000Z"),
      status: "pending_sync",
    });

    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: { attendeeName: "New", attendeeEmail: "new@example.com", startTime: "2026-10-01T09:00:00.000Z" },
    };
    const res = createMockRes();
    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("9. should not let an abandoned (stale) pending_sync booking block the slot forever", async () => {
    const stale = await MeetingBooking.create({
      userId: creator._id,
      eventTypeId: eventType60._id,
      attendeeName: "Crashed Request",
      attendeeEmail: "crashed@example.com",
      startTime: new Date("2026-10-01T09:00:00.000Z"),
      endTime: new Date("2026-10-01T10:00:00.000Z"),
      status: "pending_sync",
    });
    await MeetingBooking.collection.updateOne(
      { _id: stale._id },
      { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } }
    );

    const req = {
      params: { alias: "alex", slug: "60-min-session" },
      body: { attendeeName: "New", attendeeEmail: "new@example.com", startTime: "2026-10-01T09:00:00.000Z" },
    };
    const res = createMockRes();
    await meetingController.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("10. should never double-book when two requests race for the same slot", async () => {
    const makeReq = (email) => ({
      params: { alias: "alex", slug: "60-min-session" },
      body: { attendeeName: "Racer", attendeeEmail: email, startTime: "2026-10-01T09:00:00.000Z" },
    });
    const [r1, r2, r3] = [createMockRes(), createMockRes(), createMockRes()];

    await Promise.all([
      meetingController.createBooking(makeReq("a@example.com"), r1),
      meetingController.createBooking(makeReq("b@example.com"), r2),
      meetingController.createBooking(makeReq("c@example.com"), r3),
    ]);

    const confirmed = await MeetingBooking.countDocuments({ userId: creator._id, status: "scheduled" });
    expect(confirmed).toBe(1);
    expect([r1, r2, r3].filter((r) => r.statusCode === 201)).toHaveLength(1);
  });
});
