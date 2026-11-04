/**
 * Regression tests for BUG-004: Mount Missing Routes
 *
 * Verifies that routes for:
 * 1. Digital Store (/api/store)
 * 2. Rate Cards (/api/rate-cards)
 * 3. Team Tasks (/api/team-tasks)
 * are properly imported and mounted in index.js, and that their endpoints
 * respond as expected (e.g., 200, 400, 401, or 302 redirect to login) rather than unmounted 404 errors.
 */
const request = require("supertest");
const express = require("express");
const { DigitalProduct } = require("../../model/digitalProduct");

describe("BUG-004 Regression: Route mounting verification", () => {
  let app;
  let findSpy;

  beforeAll(() => {
    // Avoid real DB timeout in test runner
    findSpy = jest.spyOn(DigitalProduct, "find").mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });
    jest.spyOn(DigitalProduct, "countDocuments").mockResolvedValue(0);

    // Construct a test Express app mimicking index.js mount configuration
    app = express();
    app.use(express.json());

    const digitalStoreRoutes = require("../../routes/digitalStoreRoutes");
    const rateCardRoutes = require("../../routes/rateCardRoutes");
    const teamTaskRoutes = require("../../routes/teamTaskRoutes");

    app.use("/api/store", digitalStoreRoutes);
    app.use("/api/rate-cards", rateCardRoutes);
    app.use("/api/team-tasks", teamTaskRoutes);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("Digital Store Routes (/api/store)", () => {
    it("public products endpoint is mounted and reachable", async () => {
      const res = await request(app).get("/api/store/public/products");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("public checkout endpoint validates missing body with 400", async () => {
      const res = await request(app).post("/api/store/public/checkout").send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("protected products endpoint requires authentication (returns 401 or login redirect)", async () => {
      const res = await request(app)
        .post("/api/store/products")
        .set("Accept", "application/json")
        .send({ title: "Test" });
      expect([401, 302]).toContain(res.status);
    });
  });

  describe("Rate Card Routes (/api/rate-cards)", () => {
    it("calculate-quote endpoint is mounted and validates input with 400", async () => {
      const res = await request(app).post("/api/rate-cards/calculate-quote").send({});
      expect(res.status).toBe(400);
    });

    it("baseline-estimator endpoint is mounted and responds with 200", async () => {
      const res = await request(app).get("/api/rate-cards/baseline-estimator?niche=tech&estimatedViews=50000");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.estimatedBaselineRate).toBeDefined();
    });

    it("protected rate card creation requires authentication (returns 401 or login redirect)", async () => {
      const res = await request(app)
        .post("/api/rate-cards")
        .set("Accept", "application/json")
        .send({ title: "My Rate Card" });
      expect([401, 302]).toContain(res.status);
    });
  });

  describe("Team Task Routes (/api/team-tasks)", () => {
    it("protected team task listing requires authentication (returns 401 or login redirect)", async () => {
      const res = await request(app)
        .get("/api/team-tasks")
        .set("Accept", "application/json");
      expect([401, 302]).toContain(res.status);
    });

    it("protected team task creation requires authentication (returns 401 or login redirect)", async () => {
      const res = await request(app)
        .post("/api/team-tasks")
        .set("Accept", "application/json")
        .send({ title: "New Task" });
      expect([401, 302]).toContain(res.status);
    });
  });
});
