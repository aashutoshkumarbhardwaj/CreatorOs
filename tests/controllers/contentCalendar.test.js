const mongoose = require("mongoose");
const {
    renderCalendarPage,
    rescheduleItem,
    updatePerformance,
    addComment,
    deleteComment,
    createItem,
    listItems,
} = require("../../controller/contentOsController");
const ContentOs = require("../../model/contentOs");
const User = require("../../model/user");

describe("Content Calendar Controller & API Tests", () => {
    let mockReq, mockRes;
    const testUserId = new mongoose.Types.ObjectId().toString();

    beforeAll(() => {
        process.env.USE_MOCK_DB = "true";
    });

    beforeEach(async () => {
        await ContentOs.deleteMany({});

        mockReq = {
            user: { id: testUserId, email: "creator@example.com" },
            params: {},
            query: {},
            body: {},
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            render: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        User.findById = jest.fn().mockImplementation(() => ({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: testUserId,
                    name: "Test Creator",
                    email: "creator@example.com",
                }),
            }),
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("renderCalendarPage", () => {
        it("should set tab=calendar query and render content-os view", async () => {
            await renderCalendarPage(mockReq, mockRes);
            expect(mockReq.query.tab).toBe("calendar");
            expect(mockRes.render).toHaveBeenCalledWith("content-os", expect.any(Object));
        });
    });

    describe("Multi-Platform and Deadline Support in createItem", () => {
        it("should create item with multi-platforms, deadlineAt, and performance", async () => {
            mockReq.body = {
                title: "Cross Platform Reel",
                platforms: ["instagram", "youtube", "tiktok"],
                deadlineAt: "2026-09-01T15:00:00.000Z",
                performance: { views: 5000, engagementRate: 4.5 },
            };

            await createItem(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    item: expect.objectContaining({
                        title: "Cross Platform Reel",
                        platforms: expect.arrayContaining(["instagram", "youtube", "tiktok"]),
                    }),
                })
            );
        });
    });

    describe("rescheduleItem", () => {
        it("should reschedule scheduledAt date of an existing item", async () => {
            const item = await ContentOs.create({
                userId: testUserId,
                title: "Weekly Newsletter",
                scheduledAt: new Date("2026-08-15T10:00:00.000Z"),
                status: "scheduled",
            });

            mockReq.params = { id: item._id.toString() };
            const newDateStr = "2026-08-20T14:00:00.000Z";
            mockReq.body = { scheduledAt: newDateStr };

            await rescheduleItem(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: "Content item rescheduled successfully.",
                })
            );

            const updated = await ContentOs.findById(item._id);
            expect(new Date(updated.scheduledAt).toISOString()).toBe(newDateStr);
        });

        it("should return 400 if scheduledAt date is missing or invalid", async () => {
            mockReq.params = { id: "someid" };
            mockReq.body = {};

            await rescheduleItem(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "scheduledAt date is required for rescheduling.",
                })
            );
        });
    });

    describe("updatePerformance", () => {
        it("should update performance metrics for an item", async () => {
            const item = await ContentOs.create({
                userId: testUserId,
                title: "Viral Shorts",
                status: "published",
            });

            mockReq.params = { id: item._id.toString() };
            mockReq.body = { impressions: 12000, views: 9500, engagementRate: 6.2, clicks: 430 };

            await updatePerformance(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    item: expect.objectContaining({
                        performance: expect.objectContaining({
                            views: 9500,
                            engagementRate: 6.2,
                        }),
                    }),
                })
            );
        });
    });

    describe("Collaboration Comments (addComment & deleteComment)", () => {
        it("should add a comment to a content item", async () => {
            const item = await ContentOs.create({
                userId: testUserId,
                title: "Sponsor Post Draft",
                status: "scripting",
            });

            mockReq.params = { id: item._id.toString() };
            mockReq.body = { text: "Looks great! Please tweak the CTA link." };

            await addComment(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    comment: expect.objectContaining({
                        text: "Looks great! Please tweak the CTA link.",
                    }),
                })
            );

            const updated = await ContentOs.findById(item._id);
            expect(updated.comments.length).toBe(1);
            expect(updated.comments[0].text).toBe("Looks great! Please tweak the CTA link.");
        });

        it("should delete a comment from a content item", async () => {
            const item = await ContentOs.create({
                userId: testUserId,
                title: "Sponsor Post Draft",
                status: "scripting",
                comments: [{ text: "Old comment to delete", userName: "Creator" }],
            });

            const commentId = item.comments[0]._id.toString();

            mockReq.params = { id: item._id.toString(), commentId };

            await deleteComment(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: "Comment deleted successfully.",
                })
            );

            const updated = await ContentOs.findById(item._id);
            expect(updated.comments.length).toBe(0);
        });
    });
});
