const ContentOsModel = require("../model/contentOs");
const ScheduledContentModel = require("../model/scheduledContent");

/**
 * A ScheduledContent row is owned by the publish worker once it leaves the
 * "scheduled" state, so Content OS may only rewrite or cancel it while it is
 * still safe to do so:
 *  - "publishing" is in flight on a worker (rewriting it would let another
 *    worker claim it again and send the post twice),
 *  - "published" has already been delivered (rewriting it back to "scheduled"
 *    would make the worker publish the same post again).
 */
const EDITABLE_STATUSES = ["scheduled", "failed", "cancelled"];
const CANCELLABLE_STATUSES = ["scheduled", "failed"];

function buildCaption(item) {
    return item.title + (item.description ? "\n\n" + item.description : "");
}

function isScheduledItem(item) {
    return Boolean(item?.scheduledAt && item?.status === "scheduled");
}

/**
 * An already-published row is only re-queued when the creator deliberately moved
 * the item to a different, future time. An unrelated edit (title, tags, notes...)
 * keeps the same scheduledAt and must never trigger a second publish.
 */
function isDeliberateReschedule(scheduledContent, item) {
    const next = new Date(item.scheduledAt).getTime();
    const previous = scheduledContent.scheduledAt
        ? new Date(scheduledContent.scheduledAt).getTime()
        : NaN;
    return Number.isFinite(next) && next !== previous && next > Date.now();
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

async function createScheduledContent(scheduleData) {
    try {
        return await ScheduledContentModel.create(scheduleData);
    } catch (err) {
        // A concurrent sync already created the row for this Content OS item
        // (unique index on userId + contentOsId): reuse it instead of failing.
        if (err && err.code === 11000) {
            return ScheduledContentModel.findOne({
                userId: scheduleData.userId,
                contentOsId: scheduleData.contentOsId,
            });
        }
        throw err;
    }
}

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
        const scheduleData = {
            userId,
            contentOsId,
            caption: buildCaption(item),
            platform: item.platform || "general",
            timezone: scheduledContent?.timezone || "UTC",
            scheduledAt: item.scheduledAt,
            status: "scheduled",
        };

        if (!scheduledContent) {
            return createScheduledContent(scheduleData);
        }

        // In flight on a worker: leave it alone.
        if (scheduledContent.status === "publishing") {
            return scheduledContent;
        }

        if (scheduledContent.status === "published") {
            // Already delivered: never resurrect it unless the creator moved it
            // to a new future time on purpose.
            if (!isDeliberateReschedule(scheduledContent, item)) {
                return scheduledContent;
            }

            const requeued = await ScheduledContentModel.findOneAndUpdate(
                { _id: scheduledContent._id, status: "published" },
                {
                    $set: {
                        ...scheduleData,
                        publishAttempts: 0,
                        platformPostId: null,
                        publishedAt: null,
                        publishedBy: null,
                        publishingStartedAt: null,
                        errorMessage: null,
                    },
                },
                { new: true }
            );
            return requeued || ScheduledContentModel.findById(scheduledContent._id);
        }

        // Compare-and-set on the status: if a worker claimed the row between our
        // read and this write, the filter no longer matches and nothing is
        // overwritten.
        const updated = await ScheduledContentModel.findOneAndUpdate(
            { _id: scheduledContent._id, status: { $in: EDITABLE_STATUSES } },
            scheduleData,
            { new: true }
        );
        return updated || ScheduledContentModel.findById(scheduledContent._id);
    }

    if (!scheduledContent || !CANCELLABLE_STATUSES.includes(scheduledContent.status)) {
        return scheduledContent;
    }

    const cancelled = await ScheduledContentModel.findOneAndUpdate(
        { _id: scheduledContent._id, status: { $in: CANCELLABLE_STATUSES } },
        { $set: { status: "cancelled", errorMessage: null } },
        { new: true }
    );
    return cancelled || ScheduledContentModel.findById(scheduledContent._id);
}

module.exports = {
    buildCaption,
    isScheduledItem,
    syncScheduledContent,
};
