jest.mock("../model/contentOs", () => ({}));
jest.mock("../model/scheduledContent", () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
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
    const EDITABLE = { $in: ["scheduled", "failed", "cancelled"] };
    const CANCELLABLE = { $in: ["scheduled", "failed"] };

    beforeEach(() => {
        jest.resetAllMocks();
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

    test("reuses the row created by a concurrent sync instead of failing on the unique index", async () => {
        const winner = { _id: "schedule-winner" };
        ScheduledContentModel.findOne
            .mockResolvedValueOnce(null) // initial lookup
            .mockResolvedValueOnce(winner); // lookup after E11000
        ScheduledContentModel.create.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));

        const item = {
            _id: contentOsId,
            title: "Race",
            platform: "instagram",
            scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
            status: "scheduled",
        };

        await expect(syncScheduledContent({ userId, item })).resolves.toBe(winner);
    });

    test("updates the existing linked job instead of creating a duplicate", async () => {
        const existingSchedule = {
            _id: "schedule-1",
            timezone: "Asia/Kolkata",
            status: "scheduled",
        };
        ScheduledContentModel.findOne.mockResolvedValue(existingSchedule);
        ScheduledContentModel.findOneAndUpdate.mockResolvedValue({
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

        expect(ScheduledContentModel.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: "schedule-1", status: EDITABLE },
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

    test("returns the current row when a worker claims it between the read and the write", async () => {
        const claimed = { _id: "schedule-1", status: "publishing" };
        ScheduledContentModel.findOne.mockResolvedValue({ _id: "schedule-1", status: "scheduled" });
        ScheduledContentModel.findOneAndUpdate.mockResolvedValue(null); // CAS lost the race
        ScheduledContentModel.findById.mockResolvedValue(claimed);

        const item = {
            _id: contentOsId,
            title: "Edited",
            scheduledAt: new Date("2026-10-02T10:00:00.000Z"),
            status: "scheduled",
        };

        await expect(syncScheduledContent({ userId, item })).resolves.toBe(claimed);
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
        ScheduledContentModel.findOneAndUpdate.mockResolvedValue(legacySchedule);

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

        expect(ScheduledContentModel.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: "legacy-1", status: EDITABLE },
            expect.objectContaining({ contentOsId, scheduledAt: item.scheduledAt }),
            { new: true }
        );
        expect(ScheduledContentModel.create).not.toHaveBeenCalled();
    });

    describe("rows the publish worker already owns", () => {
        const pastDate = new Date(Date.now() - 60 * 60 * 1000);

        test("an unrelated edit does not re-queue an already published post", async () => {
            const published = {
                _id: "schedule-1",
                status: "published",
                scheduledAt: pastDate,
                platformPostId: "instagram_post_1",
            };
            ScheduledContentModel.findOne.mockResolvedValue(published);

            const result = await syncScheduledContent({
                userId,
                item: { _id: contentOsId, title: "Typo fix", status: "scheduled", scheduledAt: pastDate },
            });

            expect(result).toBe(published);
            expect(ScheduledContentModel.findOneAndUpdate).not.toHaveBeenCalled();
            expect(ScheduledContentModel.create).not.toHaveBeenCalled();
        });

        test("moving a published post to a new future time deliberately re-queues it", async () => {
            const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
            ScheduledContentModel.findOne.mockResolvedValue({
                _id: "schedule-1",
                status: "published",
                scheduledAt: pastDate,
                timezone: "UTC",
            });
            ScheduledContentModel.findOneAndUpdate.mockResolvedValue({ _id: "schedule-1", status: "scheduled" });

            await syncScheduledContent({
                userId,
                item: { _id: contentOsId, title: "Repost", status: "scheduled", scheduledAt: future },
            });

            expect(ScheduledContentModel.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: "schedule-1", status: "published" },
                {
                    $set: expect.objectContaining({
                        status: "scheduled",
                        scheduledAt: future,
                        publishAttempts: 0,
                        platformPostId: null,
                        publishedAt: null,
                    }),
                },
                { new: true }
            );
        });

        test("moving a published post to a new time in the past does not re-queue it", async () => {
            const published = { _id: "schedule-1", status: "published", scheduledAt: pastDate };
            ScheduledContentModel.findOne.mockResolvedValue(published);

            const result = await syncScheduledContent({
                userId,
                item: {
                    _id: contentOsId,
                    title: "Backdated",
                    status: "scheduled",
                    scheduledAt: new Date(pastDate.getTime() - 1000),
                },
            });

            expect(result).toBe(published);
            expect(ScheduledContentModel.findOneAndUpdate).not.toHaveBeenCalled();
        });

        test("a post that is mid-publish is neither rewritten nor cancelled", async () => {
            const inFlight = { _id: "schedule-1", status: "publishing", scheduledAt: pastDate };
            ScheduledContentModel.findOne.mockResolvedValue(inFlight);

            const edited = await syncScheduledContent({
                userId,
                item: { _id: contentOsId, title: "Edit", status: "scheduled", scheduledAt: pastDate },
            });
            const unscheduled = await syncScheduledContent({
                userId,
                item: { _id: contentOsId, status: "ready", scheduledAt: null },
            });

            expect(edited).toBe(inFlight);
            expect(unscheduled).toBe(inFlight);
            expect(ScheduledContentModel.findOneAndUpdate).not.toHaveBeenCalled();
        });

        test("an already published post is not cancelled when the item is unscheduled", async () => {
            const published = { _id: "schedule-1", status: "published" };
            ScheduledContentModel.findOne.mockResolvedValue(published);

            const result = await syncScheduledContent({
                userId,
                item: { _id: contentOsId, status: "ready", scheduledAt: null },
            });

            expect(result).toBe(published);
            expect(ScheduledContentModel.findOneAndUpdate).not.toHaveBeenCalled();
        });
    });

    test("cancels an existing scheduled job when the content is no longer scheduled", async () => {
        const existingSchedule = { _id: "schedule-1", status: "scheduled" };
        const cancelled = { _id: "schedule-1", status: "cancelled" };
        ScheduledContentModel.findOne.mockResolvedValue(existingSchedule);
        ScheduledContentModel.findOneAndUpdate.mockResolvedValue(cancelled);

        const result = await syncScheduledContent({
            userId,
            item: {
                _id: contentOsId,
                status: "ready",
                scheduledAt: null,
            },
        });

        expect(result).toBe(cancelled);
        expect(ScheduledContentModel.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: "schedule-1", status: CANCELLABLE },
            { $set: { status: "cancelled", errorMessage: null } },
            { new: true }
        );
    });
});
