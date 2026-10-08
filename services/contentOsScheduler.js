const ContentOsModel = require("../model/contentOs");
const ScheduledContentModel = require("../model/scheduledContent");

function buildCaption(item) {
    return item.title + (item.description ? "\n\n" + item.description : "");
}

function isScheduledItem(item) {
    return Boolean(item?.scheduledAt && item?.status === "scheduled");
}

async function findLegacyScheduledContent(userId, previousItem) {
    if (!previousItem?.scheduledAt) return null;

    const matches = await ScheduledContentModel.find({
        userId,
        caption: buildCaption(previousItem),
        platform: previousItem.platform || "general",
        scheduledAt: previousItem.scheduledAt,
        status: "scheduled",
    }).sort({ createdAt: 1 }).limit(2);

    return matches.length === 1 ? matches[0] : null;
}

// A job in one of these states is owned by the publish worker (in flight) or already live on
// the platform. Content OS edits must never rewind it back to `scheduled`, otherwise the
// worker would publish the same post a second time.
const WORKER_OWNED_STATUSES = ["publishing", "published"];
// Terminal states that a fresh schedule request is allowed to revive.
const REVIVABLE_STATUSES = ["failed", "cancelled"];

async function syncScheduledContent({ userId, item, previousItem = null }) {
    const contentOsId = item?._id;
    if (!contentOsId) return null;

    let scheduledContent = await ScheduledContentModel.findOne({
        userId,
        contentOsId,
    });

    if (!scheduledContent) {
        scheduledContent = await findLegacyScheduledContent(userId, previousItem);
    }

    if (isScheduledItem(item)) {
        if (scheduledContent && WORKER_OWNED_STATUSES.includes(scheduledContent.status)) {
            return scheduledContent;
        }

        const scheduleData = {
            userId,
            contentOsId,
            caption: buildCaption(item),
            platform: item.platform || "general",
            timezone: scheduledContent?.timezone || "UTC",
            scheduledAt: item.scheduledAt,
            status: "scheduled",
        };

        if (scheduledContent) {
            const update = { ...scheduleData };
            if (REVIVABLE_STATUSES.includes(scheduledContent.status)) {
                // Re-scheduling a failed/cancelled job starts a fresh delivery cycle.
                update.errorMessage = null;
                update.publishAttempts = 0;
                update.publishedBy = null;
                update.publishingStartedAt = null;
            }

            // Compare-and-set on the status we just read: if the worker claimed the job in the
            // meantime the update is skipped instead of rewinding `publishing` to `scheduled`.
            const updated = await ScheduledContentModel.findOneAndUpdate(
                { _id: scheduledContent._id, status: scheduledContent.status },
                { $set: update },
                { new: true }
            );

            return updated || ScheduledContentModel.findById(scheduledContent._id);
        }

        return ScheduledContentModel.create(scheduleData);
    }

    if (scheduledContent && !["published", "cancelled"].includes(scheduledContent.status)) {
        // A job that is mid-publish can no longer be recalled, so only cancel jobs that have not
        // been handed to the platform yet; again guarded against a concurrent worker claim.
        const cancelled = await ScheduledContentModel.findOneAndUpdate(
            { _id: scheduledContent._id, status: { $in: ["scheduled", "failed"] } },
            { $set: { status: "cancelled", errorMessage: null } },
            { new: true }
        );

        return cancelled || ScheduledContentModel.findById(scheduledContent._id);
    }

    return scheduledContent;
}

module.exports = {
    buildCaption,
    isScheduledItem,
    syncScheduledContent,
};
