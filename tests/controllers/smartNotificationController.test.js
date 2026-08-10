const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../../model/user");
const Notification = require("../../model/notification");
const NotificationPreference = require("../../model/notificationPreference");
const { BRAND } = require("../../utils/brand");
const smartNotificationRoutes = require("../../routes/smartNotificationRoutes");

describe("smartNotificationController & API Integration", () => {
    let app;
    let testUser;
    let authToken;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        const cookieParser = require("cookie-parser");
        app.use(cookieParser());

        app.set("view engine", "ejs");
        app.set("views", "./view");
        app.locals.BRAND = BRAND;
        app.use((req, res, next) => {
            res.locals.nonce = "test-nonce";
            next();
        });

        app.use("/", smartNotificationRoutes);
    });

    beforeEach(async () => {
        await Notification.deleteMany({});
        await NotificationPreference.deleteMany({});
        await User.deleteMany({});

        testUser = await User.create({
            name: "Test Controller User",
            email: "testcontroller@example.com",
            password: "password123",
            isVerified: true,
        });

        authToken = jwt.sign(
            { id: testUser._id.toString(), email: testUser.email, role: "creator" },
            process.env.JWT_SECRET || "test_secret_key"
        );
    });

    describe("GET /services/smart-notifications", () => {
        it("should render smart-notifications HTML view", async () => {
            const res = await request(app)
                .get("/services/smart-notifications")
                .set("Cookie", [`token=${authToken}`]);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain("Smart Notifications");
        });
    });

    describe("GET /api/notifications/preferences", () => {
        it("should return notification preferences for user", async () => {
            const res = await request(app)
                .get("/api/notifications/preferences")
                .set("Cookie", [`token=${authToken}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.channels.email).toBe(true);
        });
    });

    describe("PUT /api/notifications/preferences", () => {
        it("should update user notification preferences", async () => {
            const res = await request(app)
                .put("/api/notifications/preferences")
                .set("Cookie", [`token=${authToken}`])
                .send({
                    channels: { sms: true, push: true },
                    quietHours: { enabled: true, startTime: "23:00", endTime: "07:00" },
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.channels.sms).toBe(true);
            expect(res.body.data.quietHours.enabled).toBe(true);
        });
    });

    describe("POST /api/notifications and GET /api/notifications", () => {
        it("should create a new notification and fetch it from history", async () => {
            const createRes = await request(app)
                .post("/api/notifications")
                .set("Cookie", [`token=${authToken}`])
                .send({
                    title: "Test Campaign Alert",
                    message: "Campaign started",
                    category: "content",
                    priority: "high",
                });

            expect(createRes.statusCode).toBe(201);
            expect(createRes.body.success).toBe(true);
            expect(createRes.body.data.title).toBe("Test Campaign Alert");

            const getRes = await request(app)
                .get("/api/notifications")
                .set("Cookie", [`token=${authToken}`]);

            expect(getRes.statusCode).toBe(200);
            expect(getRes.body.notifications.length).toBe(1);
            expect(getRes.body.unreadCount).toBe(1);
        });
    });

    describe("POST /api/notifications/test", () => {
        it("should send a test notification across channels", async () => {
            const res = await request(app)
                .post("/api/notifications/test")
                .set("Cookie", [`token=${authToken}`])
                .send({ channel: "all", category: "system" });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain("Test notification sent");
        });
    });

    describe("PATCH /api/notifications/:id/read and archive", () => {
        it("should mark notification as read and archive it", async () => {
            const notif = await Notification.create({
                userId: testUser._id,
                title: "Mark Me Read",
                message: "Text",
                status: "sent",
            });

            const readRes = await request(app)
                .patch(`/api/notifications/${notif._id}/read`)
                .set("Cookie", [`token=${authToken}`]);

            expect(readRes.statusCode).toBe(200);
            expect(readRes.body.data.status).toBe("read");

            const archiveRes = await request(app)
                .patch(`/api/notifications/${notif._id}/archive`)
                .set("Cookie", [`token=${authToken}`]);

            expect(archiveRes.statusCode).toBe(200);
            expect(archiveRes.body.data.status).toBe("archived");
        });
    });

    describe("DELETE /api/notifications/:id", () => {
        it("should delete a notification document", async () => {
            const notif = await Notification.create({
                userId: testUser._id,
                title: "Delete Me",
                message: "Text",
            });

            const delRes = await request(app)
                .delete(`/api/notifications/${notif._id}`)
                .set("Cookie", [`token=${authToken}`]);

            expect(delRes.statusCode).toBe(200);
            expect(delRes.body.success).toBe(true);

            const count = await Notification.countDocuments({ _id: notif._id });
            expect(count).toBe(0);
        });
    });

    describe("GET /api/notifications/analytics", () => {
        it("should return notification analytics metrics", async () => {
            await Notification.create({
                userId: testUser._id,
                title: "Analytics Item",
                message: "Text",
                category: "analytics",
                status: "sent",
                readAt: new Date(),
            });

            const res = await request(app)
                .get("/api/notifications/analytics")
                .set("Cookie", [`token=${authToken}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalNotifications).toBe(1);
            expect(res.body.data.openRate).toBe(100);
        });
    });
});
