
jest.mock("../model/contentOs", () => ({}));

jest.mock("../model/scheduledContent", () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
}));

const ScheduledContentModel = require("../model/scheduledContent");

const {
    buildCaption,
    isScheduledItem,
    syncScheduledContent,
} = require("../services/contentOsScheduler");

describe("contentOsScheduler", () => {
    const userId = "user-1";
    const contentOsId = "content-1";

    const createItem = (overrides = {}) => ({
        _id: contentOsId,
        title: "Test post",
        description: "Test description",
        platform: "youtube",
        scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
        status: "scheduled",
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();

        ScheduledContentModel.findOne.mockResolvedValue(null);
        ScheduledContentModel.find.mockReturnValue({
            sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([]),
            }),
        });

        ScheduledContentModel.create.mockResolvedValue({
            _id: "schedule-1",
        });

        ScheduledContentModel.findByIdAndUpdate.mockResolvedValue({
            _id: "schedule-1",
        });
    });

    // --------------------------------------------------
    // buildCaption
    // --------------------------------------------------

    describe("buildCaption", () => {
        test("combines title and description", () => {
            expect(
                buildCaption({
                    title: "Title",
                    description: "Description",
                })
            ).toBe("Title\n\nDescription");
        });

        test("returns only title when description is empty", () => {
            expect(
                buildCaption({
                    title: "Title",
                    description: "",
                })
            ).toBe("Title");
        });

        test("returns only description when title is empty", () => {
            expect(
                buildCaption({
                    title: "",
                    description: "Description",
                })
            ).toBe("Description");
        });

        test("handles missing title and description", () => {
            expect(buildCaption({})).toBe("");
        });

        test("handles null or undefined input safely", () => {
            expect(buildCaption(null)).toBe("");
            expect(buildCaption(undefined)).toBe("");
        });

        test("does not add unnecessary blank lines", () => {
            expect(
                buildCaption({
                    title: "Title",
                    description: "   ",
                })
            ).toBe("Title");
        });
    });

    // --------------------------------------------------
    // isScheduledItem
    // --------------------------------------------------

    describe("isScheduledItem", () => {
        test("returns true for a scheduled item with a valid date", () => {
            expect(
                isScheduledItem({
                    status: "scheduled",
                    scheduledAt: new Date(),
                })
            ).toBe(true);
        });

        test("returns false when scheduledAt is null", () => {
            expect(
                isScheduledItem({
                    status: "scheduled",
                    scheduledAt: null,
                })
            ).toBe(false);
        });

        test("returns false when status is not scheduled", () => {
            expect(
                isScheduledItem({
                    status: "ready",
                    scheduledAt: new Date(),
                })
            ).toBe(false);
        });

        test("returns false for missing input", () => {
            expect(isScheduledItem(null)).toBe(false);
            expect(isScheduledItem(undefined)).toBe(false);
        });

        test("returns false for an invalid date", () => {
            expect(
                isScheduledItem({
                    status: "scheduled",
                    scheduledAt: "invalid-date",
                })
            ).toBe(false);
        });
    });

    // --------------------------------------------------
    // syncScheduledContent
    // --------------------------------------------------

    describe("syncScheduledContent", () => {
        test("creates a new scheduled job", async () => {
            const item = createItem();

            await expect(
                syncScheduledContent({ userId, item })
            ).resolves.toEqual({ _id: "schedule-1" });

            expect(ScheduledContentModel.create).toHaveBeenCalledTimes(1);

            expect(ScheduledContentModel.create).toHaveBeenCalledWith({
                userId,
                contentOsId,
                caption: "Test post\n\nTest description",
                platform: "youtube",
                timezone: "UTC",
                scheduledAt: item.scheduledAt,
                status: "scheduled",
            });
        });

        test("updates an existing linked job instead of creating a duplicate", async () => {
            const existingSchedule = {
                _id: "schedule-1",
                timezone: "Asia/Kolkata",
                status: "scheduled",
            };

            ScheduledContentModel.findOne.mockResolvedValue(existingSchedule);

            const item = createItem({
                title: "Updated post",
                description: "Updated description",
                platform: "instagram",
                scheduledAt: new Date("2026-10-02T10:00:00.000Z"),
            });

            await syncScheduledContent({ userId, item });

            expect(
                ScheduledContentModel.findByIdAndUpdate
            ).toHaveBeenCalledWith(
                "schedule-1",
                {
                    userId,
                    contentOsId,
                    caption: "Updated post\n\nUpdated description",
                    platform: "instagram",
                    timezone: "Asia/Kolkata",
                    scheduledAt: item.scheduledAt,
                    status: "scheduled",
                },
                { new: true }
            );

            expect(ScheduledContentModel.create).not.toHaveBeenCalled();
        });

        test("links a matching unlinked legacy job", async () => {
            const legacySchedule = {
                _id: "legacy-1",
                timezone: "UTC",
                status: "scheduled",
            };

            ScheduledContentModel.findOne.mockResolvedValue(null);

            const limit = jest.fn().mockResolvedValue([legacySchedule]);
            const sort = jest.fn().mockReturnValue({ limit });

            ScheduledContentModel.find.mockReturnValue({ sort });

            const item = createItem({
                title: "Rescheduled post",
                scheduledAt: new Date("2026-10-03T10:00:00.000Z"),
            });

            const previousItem = createItem();

            await syncScheduledContent({
                userId,
                item,
                previousItem,
            });

            expect(
                ScheduledContentModel.findByIdAndUpdate
            ).toHaveBeenCalledWith(
                "legacy-1",
                expect.objectContaining({
                    userId,
                    contentOsId,
                    scheduledAt: item.scheduledAt,
                }),
                { new: true }
            );

            expect(ScheduledContentModel.create).not.toHaveBeenCalled();
        });

        test("creates a new job when no matching legacy job exists", async () => {
            ScheduledContentModel.findOne.mockResolvedValue(null);

            const item = createItem();

            await syncScheduledContent({ userId, item });

            expect(ScheduledContentModel.create).toHaveBeenCalledTimes(1);
        });

        test("cancels an existing job when content is no longer scheduled", async () => {
            const save = jest.fn().mockResolvedValue({
                _id: "schedule-1",
                status: "cancelled",
            });

            const existingSchedule = {
                _id: "schedule-1",
                status: "scheduled",
                save,
            };

            ScheduledContentModel.findOne.mockResolvedValue(existingSchedule);

            await syncScheduledContent({
                userId,
                item: createItem({
                    status: "ready",
                    scheduledAt: null,
                }),
            });

            expect(existingSchedule.status).toBe("cancelled");
            expect(save).toHaveBeenCalledTimes(1);
        });

        test("does not create a job for an item that is not scheduled", async () => {
            await syncScheduledContent({
                userId,
                item: createItem({
                    status: "draft",
                    scheduledAt: null,
                }),
            });

            expect(ScheduledContentModel.create).not.toHaveBeenCalled();
        });

        test("preserves the existing timezone when updating a job", async () => {
            ScheduledContentModel.findOne.mockResolvedValue({
                _id: "schedule-1",
                timezone: "Asia/Kolkata",
                status: "scheduled",
            });

            await syncScheduledContent({
                userId,
                item: createItem(),
            });

            expect(
                ScheduledContentModel.findByIdAndUpdate
            ).toHaveBeenCalledWith(
                "schedule-1",
                expect.objectContaining({
                    timezone: "Asia/Kolkata",
                }),
                { new: true }
            );
        });

        test("uses UTC when creating a job without an existing timezone", async () => {
            ScheduledContentModel.findOne.mockResolvedValue(null);

            await syncScheduledContent({
                userId,
                item: createItem(),
            });

            expect(ScheduledContentModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    timezone: "UTC",
                })
            );
        });

        test("does not create duplicate jobs when an existing job is found", async () => {
            ScheduledContentModel.findOne.mockResolvedValue({
                _id: "schedule-1",
                timezone: "UTC",
                status: "scheduled",
            });

            await syncScheduledContent({
                userId,
                item: createItem(),
            });

            expect(ScheduledContentModel.create).not.toHaveBeenCalled();
            expect(
                ScheduledContentModel.findByIdAndUpdate
            ).toHaveBeenCalledTimes(1);
        });
    });
});
