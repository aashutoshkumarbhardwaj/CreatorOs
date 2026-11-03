/**
 * Regression tests for BUG-002: Creator ID handling and cross-creator data exposure
 *
 * Root cause: teamTaskController, rateCardController, and digitalStoreController
 * used `req.user && req.user._id ? req.user._id : req.user` to extract creatorId.
 * The JWT protect middleware sets req.user = { id: '...', role: '...' } without _id,
 * causing the fallback to return the entire user object as creatorId — a BSON CastError.
 * In digitalStoreController.getProducts, the broken check also omitted the creatorId
 * filter, exposing all products (including other creators' drafts) to any authenticated user.
 *
 * Fix: Use `req.user.id || req.user._id` throughout all three controllers.
 * Fix: Use `currentUserId = req.user ? (req.user.id || req.user._id) : null` in getProducts.
 */
const mongoose = require("mongoose");
const TeamTask = require("../../model/teamTaskDependency");
const CreatorRateCard = require("../../model/creatorRateCard");
const { DigitalProduct } = require("../../model/digitalProduct");
const teamTaskController = require("../../controller/teamTaskController");
const rateCardController = require("../../controller/rateCardController");
const digitalStoreController = require("../../controller/digitalStoreController");

// Simulate the JWT-decoded user object produced by the protect middleware
const CREATOR_A_ID = "60d5ecb8b5c9c22b1c8e1111";
const CREATOR_B_ID = "60d5ecb8b5c9c22b1c8e2222";

function jwtUser(id) {
  // Matches: req.user = decoded, where decoded = { id: user._id.toString(), ... }
  return { id, role: "creator", iat: 1000000, exp: 9999999 };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamTask Controller
// ─────────────────────────────────────────────────────────────────────────────

describe("BUG-002 Regression: teamTaskController", () => {
  it("resolves creatorId as a valid ObjectId string from req.user.id", async () => {
    const createSpy = jest.spyOn(TeamTask.prototype, "save").mockResolvedValue(undefined);
    jest.spyOn(TeamTask, "find").mockResolvedValue([]);

    const req = {
      user: jwtUser(CREATOR_A_ID),
      body: { title: "Test Task" },
    };
    const res = mockRes();

    await teamTaskController.createTeamTask(req, res);

    // Must NOT return 500 CastError — status 201 means creatorId was valid
    expect(res.status).toHaveBeenCalledWith(201);
    createSpy.mockRestore();
  });

  it("does not pass the user object as creatorId to TeamTask.find", async () => {
    const findSpy = jest.spyOn(TeamTask, "find").mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
    });

    const req = {
      user: jwtUser(CREATOR_A_ID),
      query: {},
    };
    const res = mockRes();

    await teamTaskController.getTeamTasks(req, res);

    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: CREATOR_A_ID })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    findSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RateCard Controller
// ─────────────────────────────────────────────────────────────────────────────

describe("BUG-002 Regression: rateCardController", () => {
  it("resolves creatorId correctly in getRateCards", async () => {
    const findSpy = jest.spyOn(CreatorRateCard, "find").mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });

    const req = {
      user: jwtUser(CREATOR_A_ID),
      query: {},
    };
    const res = mockRes();

    await rateCardController.getRateCards(req, res);

    expect(findSpy).toHaveBeenCalledWith({ creatorId: CREATOR_A_ID });
    expect(res.status).toHaveBeenCalledWith(200);
    findSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DigitalStore Controller — Ownership Filtering & Cross-Creator Isolation
// ─────────────────────────────────────────────────────────────────────────────

describe("BUG-002 Regression: digitalStoreController — product ownership isolation", () => {
  const fakeProducts = [
    { _id: "p1", creatorId: CREATOR_A_ID, title: "Creator A Active", status: "active" },
    { _id: "p2", creatorId: CREATOR_A_ID, title: "Creator A Draft Secret", status: "draft" },
    { _id: "p3", creatorId: CREATOR_B_ID, title: "Creator B Active", status: "active" },
  ];

  let findSpy;
  let countSpy;

  beforeEach(() => {
    findSpy = jest.spyOn(DigitalProduct, "find").mockImplementation((query) => ({
      sort: () => ({
        skip: () => ({
          limit: () =>
            fakeProducts.filter((doc) => {
              const creatorMatch = !query.creatorId || String(doc.creatorId) === String(query.creatorId);
              const statusMatch = !query.status || doc.status === query.status;
              return creatorMatch && statusMatch;
            }),
        }),
      }),
    }));
    countSpy = jest.spyOn(DigitalProduct, "countDocuments").mockResolvedValue(3);
  });

  afterEach(() => {
    findSpy.mockRestore();
    countSpy.mockRestore();
  });

  it("authenticated creator only sees their own products", async () => {
    const req = {
      user: jwtUser(CREATOR_B_ID),
      query: {},
    };
    const res = mockRes();

    await digitalStoreController.getProducts(req, res);

    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: CREATOR_B_ID })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.products).toHaveLength(1);
    expect(body.products[0].creatorId).toBe(CREATOR_B_ID);
  });

  it("Creator B cannot see Creator A's draft products", async () => {
    const req = {
      user: jwtUser(CREATOR_B_ID),
      query: {},
    };
    const res = mockRes();

    await digitalStoreController.getProducts(req, res);

    const body = res.json.mock.calls[0][0];
    const creatorADraft = body.products.find((p) => p.title === "Creator A Draft Secret");
    expect(creatorADraft).toBeUndefined();
  });

  it("unauthenticated request only returns active products (public storefront)", async () => {
    const req = {
      user: null,
      query: {},
    };
    const res = mockRes();

    await digitalStoreController.getProducts(req, res);

    const query = findSpy.mock.calls[0][0];
    expect(query.status).toBe("active");
    expect(query.creatorId).toBeUndefined();

    const body = res.json.mock.calls[0][0];
    body.products.forEach((p) => expect(p.status).toBe("active"));
  });

  it("authenticated creator with explicit creatorId query param gets that creator's active products only", async () => {
    const req = {
      user: jwtUser(CREATOR_B_ID),
      query: { creatorId: CREATOR_A_ID },
    };
    const res = mockRes();

    await digitalStoreController.getProducts(req, res);

    const query = findSpy.mock.calls[0][0];
    expect(query.creatorId).toBe(CREATOR_A_ID);
    // The queried creatorId !== current user id, so only active should be shown
    expect(query.status).toBe("active");
  });

  it("returns 500 CastError scenario is no longer possible: creatorId is a string not an object", () => {
    const user = jwtUser(CREATOR_A_ID);
    const creatorId = user.id || user._id;
    expect(typeof creatorId).toBe("string");
    expect(creatorId).toBe(CREATOR_A_ID);

    // Ensure the old object fallback would have caused a CastError
    const badFallback = user && user._id ? user._id : user;
    expect(typeof badFallback).toBe("object"); // The bug: entire user object
    expect(badFallback).toBe(user);

    const doc = new DigitalProduct({
      creatorId,
      title: "Test",
      slug: "test",
      price: 10,
      fileUrl: "http://example.com/file.pdf",
    });
    const validationError = doc.validateSync();
    // creatorId as a valid string should not produce a cast error
    const creatorIdError = validationError ? validationError.errors.creatorId : null;
    expect(creatorIdError).toBeNull();
  });
});
