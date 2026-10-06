const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

const User = require("../../model/user");
const Task = require("../../model/task");
const taskRoutes = require("../../routes/taskRoutes");
const { logTaskTime, getTaskById } = require("../../controller/taskController");

describe("POST /api/tasks/:id/time-log - Task Time Logging", () => {
  let app;
  let testUser;
  let authToken;
  let testTask;

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

    testTask = await Task.create({
      creatorId: testUser._id,
      title: "Video Editing",
      category: "content",
      priority: "high",
      spentHours: 2.0,
    });
  });

  describe("API Route Integration (Database Mode)", () => {
    it("should accept a positive duration and increase spentHours (60 minutes -> +1.0 hour)", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: 60 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.task.spentHours).toBe(3.0);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(3.0);
    });

    it("should accept valid decimal duration (30 minutes -> +0.5 hours)", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: 30 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.task.spentHours).toBe(2.5);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.5);
    });

    it("should accept a numeric string representing a positive number", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: "45" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.task.spentHours).toBe(2.75);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.75);
    });

    it("should reject negative duration and not reduce spentHours", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: -60 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/positive finite number/i);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject negative numeric string and not reduce spentHours", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: "-60" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject zero duration and not modify spentHours", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject zero string and not modify spentHours", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: "0" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject missing durationMinutes field", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject null durationMinutes", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: null });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject empty string and whitespace durationMinutes", async () => {
      const resEmpty = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: "" });

      expect(resEmpty.status).toBe(400);

      const resWhitespace = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: "   " });

      expect(resWhitespace.status).toBe(400);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject non-numeric string ('abc')", async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject boolean and object durations", async () => {
      const resBool = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: true });
      expect(resBool.status).toBe(400);

      const resArr = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: [60] });
      expect(resArr.status).toBe(400);

      const resObj = await request(app)
        .post(`/api/tasks/${testTask._id}/time-log`)
        .set("Cookie", [`token=${authToken}`])
        .send({ durationMinutes: { value: 60 } });
      expect(resObj.status).toBe(400);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });
  });

  describe("Controller Unit Validation (Non-finite values & Mock Mode)", () => {
    function createMockRes() {
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };
      return res;
    }

    it("should reject Infinity and -Infinity directly at the controller", async () => {
      const resInf = createMockRes();
      await logTaskTime(
        { params: { id: testTask._id.toString() }, body: { durationMinutes: Infinity } },
        resInf,
        () => {}
      );
      expect(resInf.statusCode).toBe(400);
      expect(resInf.body.success).toBe(false);

      const resNegInf = createMockRes();
      await logTaskTime(
        { params: { id: testTask._id.toString() }, body: { durationMinutes: -Infinity } },
        resNegInf,
        () => {}
      );
      expect(resNegInf.statusCode).toBe(400);
      expect(resNegInf.body.success).toBe(false);

      const resNaN = createMockRes();
      await logTaskTime(
        { params: { id: testTask._id.toString() }, body: { durationMinutes: NaN } },
        resNaN,
        () => {}
      );
      expect(resNaN.statusCode).toBe(400);
      expect(resNaN.body.success).toBe(false);

      const refreshed = await Task.findById(testTask._id);
      expect(refreshed.spentHours).toBe(2.0);
    });

    it("should reject invalid inputs consistently in mock mode without mutating mock tasks", async () => {
      const prevEnv = process.env.USE_MOCK_DB;
      process.env.USE_MOCK_DB = "true";

      try {
        const resNegative = createMockRes();
        await logTaskTime(
          { params: { id: "mock-task-1" }, body: { durationMinutes: -60 } },
          resNegative,
          () => {}
        );
        expect(resNegative.statusCode).toBe(400);
        expect(resNegative.body.success).toBe(false);

        const resZero = createMockRes();
        await logTaskTime(
          { params: { id: "mock-task-1" }, body: { durationMinutes: 0 } },
          resZero,
          () => {}
        );
        expect(resZero.statusCode).toBe(400);
        expect(resZero.body.success).toBe(false);

        const resMissing = createMockRes();
        await logTaskTime(
          { params: { id: "mock-task-1" }, body: {} },
          resMissing,
          () => {}
        );
        expect(resMissing.statusCode).toBe(400);
        expect(resMissing.body.success).toBe(false);

        const resGetInitial = createMockRes();
        await getTaskById(
          { params: { id: "mock-task-1" } },
          resGetInitial,
          () => {}
        );
        const initialSpentHours = resGetInitial.body.task.spentHours;

        // Positive duration should still work in mock mode
        const resPositive = createMockRes();
        await logTaskTime(
          { params: { id: "mock-task-1" }, body: { durationMinutes: 60 } },
          resPositive,
          () => {}
        );
        expect(resPositive.statusCode).toBe(200);
        expect(resPositive.body.success).toBe(true);
        expect(resPositive.body.task.spentHours).toBe(initialSpentHours + 1);
      } finally {
        process.env.USE_MOCK_DB = prevEnv;
      }
    });
  });
});
