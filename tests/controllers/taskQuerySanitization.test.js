const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const User = require("../../model/user");
const Task = require("../../model/task");
const taskRoutes = require("../../routes/taskRoutes");

describe("GET /api/tasks - NoSQL query-operator injection", () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use("/", taskRoutes);
  });

  beforeEach(async () => {
    await Task.deleteMany({});
    await User.deleteMany({});

    testUser = await User.create({
      name: "Task Creator",
      email: "creator@example.com",
      password: "password123",
      isVerified: true,
    });

    authToken = jwt.sign(
      { id: testUser._id.toString(), email: testUser.email, role: "creator" },
      process.env.JWT_SECRET || "test_secret_key"
    );

    await Task.create([
      {
        creatorId: testUser._id,
        title: "Edit sponsor video",
        category: "editing",
        priority: "high",
        status: "todo",
      },
      {
        creatorId: testUser._id,
        title: "Publish sponsor video",
        category: "editing",
        priority: "high",
        status: "completed",
      },
    ]);
  });

  it("does not let status[$ne]=... bypass the status filter as a Mongo operator", async () => {
    // Without sanitization, qs parses this into req.query.status = { $ne: "completed" },
    // which Mongoose would honor as an operator and return only the "todo" task.
    const res = await request(app)
      .get("/api/tasks")
      .query("status[$ne]=completed")
      .set("Cookie", [`token=${authToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The injected operator must be stripped rather than honored: since the
    // (now invalid, object-typed) status filter is dropped, both tasks come
    // back unfiltered instead of the "completed" one being excluded.
    const statuses = res.body.tasks.map((t) => t.status).sort();
    expect(statuses).toEqual(["completed", "todo"]);
  });

  it("does not let priority[$exists]=... reach the Mongo query as an object", async () => {
    const res = await request(app)
      .get("/api/tasks")
      .query("priority[$exists]=true")
      .set("Cookie", [`token=${authToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tasks).toHaveLength(2);
  });

  it("does not crash with a TypeError when search is sent as an operator object", async () => {
    // Before the fix, escapeRegex(search) would throw when `search` was an
    // object like { $ne: "x" } instead of a string, surfacing as a 500.
    const res = await request(app)
      .get("/api/tasks")
      .query("search[$ne]=x")
      .set("Cookie", [`token=${authToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("still applies a normal string status filter", async () => {
    const res = await request(app)
      .get("/api/tasks")
      .query({ status: "completed" })
      .set("Cookie", [`token=${authToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].status).toBe("completed");
  });
});
