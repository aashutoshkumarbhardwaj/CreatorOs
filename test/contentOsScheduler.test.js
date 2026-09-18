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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("builds the scheduled caption from title and description", () => {
        expect(buildCaption({ title: "Title", description: "Description" })).toBe(
            "Title\n\nDescription"
        );
        expect(buildCaption({ title: "Title", description: "" })).toBe("Title");
    });

    test("recognizes only scheduled items with a schedule time", () => {
        expect(isScheduledItem({ status: "scheduled", scheduledAt: new Date() })).toBe(true);
        expect(isScheduledItem({ status: "scheduled", scheduledAt: null })).toBe(false);
        expect(isScheduledItem({ status: "ready", scheduledAt: new Date() })).toBe(false);
    });

    test("creates one linked scheduled job for a newly scheduled item", async () => {
        ScheduledContentModel.findOne.mockResolvedValue(null);
        ScheduledContentModel.create.mockResolvedValue({ _id: "schedule-1" });

        const item = {
            _id: contentOsId,
            title: "New post",
            description: "Body",
            platform: "youtube",
            scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
            status: "scheduled",
        };

        await expect(syncScheduledContent({ userId, item })).resolves.toEqual({ _id: "schedule-1" });
        expect(ScheduledContentModel.create).toHaveBeenCalledWith({
            userId,
            contentOsId,
            caption: "New post\n\nBody",
            platform: "youtube",
            timezone: "UTC",
            scheduledAt: item.scheduledAt,
            status: "scheduled",
        });
    });

    test("updates the existing linked job instead of creating a duplicate", async () => {
        const existingSchedule = {
            _id: "schedule-1",
            timezone: "Asia/Kolkata",
            status: "scheduled",
        };
        ScheduledContentModel.findOne.mockResolvedValue(existingSchedule);
        ScheduledContentModel.findByIdAndUpdate.mockResolvedValue({
            ...existingSchedule,
            scheduledAt: new Date("2026-10-02T10:00:00.000Z"),
        });

        const item = {
            _id: contentOsId,
            title: "Updated post",
            description: "Updated body",
            platform: "instagram",
            scheduledAt: new Date("2026-10-02T10:00:00.000Z"),
            status: "scheduled",
        };

        await syncScheduledContent({ userId, item });

        expect(ScheduledContentModel.findByIdAndUpdate).toHaveBeenCalledWith(
            "schedule-1",
            {
                userId,
                contentOsId,
                caption: "Updated post\n\nUpdated body",
                platform: "instagram",
                timezone: "Asia/Kolkata",
                scheduledAt: item.scheduledAt,
                status: "scheduled",
            },
            { new: true }
        );
        expect(ScheduledContentModel.create).not.toHaveBeenCalled();
    });

    test("links an unlinked legacy job when its old schedule matches uniquely", async () => {
        ScheduledContentModel.findOne.mockResolvedValue(null);
        const legacySchedule = {
            _id: "legacy-1",
            timezone: "UTC",
            status: "scheduled",
        };
        const limit = jest.fn().mockResolvedValue([legacySchedule]);
        const sort = jest.fn().mockReturnValue({ limit });
        ScheduledContentModel.find.mockReturnValue({ sort });
        ScheduledContentModel.findByIdAndUpdate.mockResolvedValue(legacySchedule);

        const previousItem = {
            _id: contentOsId,
            title: "Original post",
            description: "Original body",
            platform: "youtube",
            scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
            status: "scheduled",
        };
        const item = {
            ...previousItem,
            title: "Rescheduled post",
            scheduledAt: new Date("2026-10-03T10:00:00.000Z"),
        };

        await syncScheduledContent({ userId, item, previousItem });

        expect(ScheduledContentModel.findByIdAndUpdate).toHaveBeenCalledWith(
            "legacy-1",
            expect.objectContaining({ contentOsId, scheduledAt: item.scheduledAt }),
            { new: true }
        );
        expect(ScheduledContentModel.create).not.toHaveBeenCalled();
    });

    test("cancels an existing scheduled job when the content is no longer scheduled", async () => {
        const save = jest.fn().mockResolvedValue({ _id: "schedule-1", status: "cancelled" });
        const existingSchedule = {
            _id: "schedule-1",
            status: "scheduled",
            save,
        };
        ScheduledContentModel.findOne.mockResolvedValue(existingSchedule);

        await syncScheduledContent({
            userId,
            item: {
                _id: contentOsId,
                status: "ready",
                scheduledAt: null,
            },
        });

        expect(existingSchedule.status).toBe("cancelled");
        expect(save).toHaveBeenCalledTimes(1);
    });
});
