// Simulates the distributed lock expiring mid-request: the lock manager grants the lock to
// EVERYONE, so mutual exclusion must come from the database-level reservation + tie-break.
jest.mock("../../utils/bookingLock", () => ({
  createLockManager: () => ({
    acquire: async () => "always-granted",
    release: async () => true,
  }),
}));

const User = require("../../model/user");
const EventType = require("../../model/eventType");
const MeetingBooking = require("../../model/meetingBooking");
const GoogleCalendarService = require("../../services/googleCalendarService");
const meetingController = require("../../controller/meetingController");

describe("createBooking when the calendar lock provides no mutual exclusion", () => {
  let creator;

  beforeEach(async () => {
    await User.deleteMany({});
    await EventType.deleteMany({});
    await MeetingBooking.deleteMany({});

    creator = await User.create({
      name: "Lock Expiry Creator",
      email: "lockexpiry@example.com",
      password: "Password123!",
      alias: "lockexpiry",
      role: "creator",
    });
    await EventType.create({
      userId: creator._id,
      title: "60 Min Session",
      slug: "60-min-session",
      duration: 60,
      isActive: true,
      locationType: "google_meet",
    });

    // Slow external call widens the race window, as a real Google API call would.
    jest.spyOn(GoogleCalendarService, "createCalendarEvent").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { meetingLink: "https://meet.google.com/x", eventId: `evt_${Math.random()}` };
    });
    jest.spyOn(GoogleCalendarService, "deleteCalendarEvent").mockResolvedValue(true);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await User.deleteMany({});
    await EventType.deleteMany({});
    await MeetingBooking.deleteMany({});
  });

  function mockRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn((c) => { res.statusCode = c; return res; });
    res.json = jest.fn((b) => { res.body = b; return res; });
    return res;
  }

  it("never produces two confirmed bookings for the same slot", async () => {
    const makeReq = (email) => ({
      params: { alias: "lockexpiry", slug: "60-min-session" },
      body: { attendeeName: "Racer", attendeeEmail: email, startTime: "2026-10-01T09:00:00.000Z" },
    });
    const responses = [mockRes(), mockRes(), mockRes(), mockRes()];

    // Deterministic interleaving: hold every request at its pre-check until ALL of them have
    // arrived, so all pass the "is the slot free?" query before any reservation exists.
    const originalFindOne = MeetingBooking.findOne.bind(MeetingBooking);
    let arrived = 0;
    let openGate;
    const gate = new Promise((resolve) => { openGate = resolve; });
    jest.spyOn(MeetingBooking, "findOne").mockImplementation((...args) => {
      if (arrived < responses.length) {
        arrived += 1;
        const result = originalFindOne(...args);
        if (arrived === responses.length) openGate();
        return gate.then(() => result);
      }
      return originalFindOne(...args);
    });

    await Promise.all(
      responses.map((res, i) => meetingController.createBooking(makeReq(`r${i}@example.com`), res))
    );

    const confirmed = await MeetingBooking.countDocuments({ userId: creator._id, status: "scheduled" });
    const leftoverPending = await MeetingBooking.countDocuments({ userId: creator._id, status: "pending_sync" });

    expect(confirmed).toBeLessThanOrEqual(1);
    expect(leftoverPending).toBe(0);
    expect(responses.filter((r) => r.statusCode === 201).length).toBe(confirmed);
    responses.filter((r) => r.statusCode !== 201).forEach((r) => expect(r.statusCode).toBe(409));
  });

  it("cleans up the Google event if committing the booking fails after the event was created", async () => {
    jest.spyOn(MeetingBooking.prototype, "save").mockRejectedValueOnce(new Error("db write failed"));
    const res = mockRes();

    await meetingController.createBooking(
      {
        params: { alias: "lockexpiry", slug: "60-min-session" },
        body: { attendeeName: "A", attendeeEmail: "a@example.com", startTime: "2026-10-01T09:00:00.000Z" },
      },
      res
    );

    expect(res.statusCode).toBe(500);
    expect(GoogleCalendarService.deleteCalendarEvent).toHaveBeenCalledTimes(1);
    expect(await MeetingBooking.countDocuments({ userId: creator._id })).toBe(0);
  });
});
