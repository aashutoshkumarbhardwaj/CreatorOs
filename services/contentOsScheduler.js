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

        if (scheduledContent) {
            return ScheduledContentModel.findByIdAndUpdate(
                scheduledContent._id,
                scheduleData,
                { new: true }
            );
        }

        return ScheduledContentModel.create(scheduleData);
    }

    if (scheduledContent && !["published", "cancelled"].includes(scheduledContent.status)) {
        scheduledContent.status = "cancelled";
        scheduledContent.errorMessage = null;
        return scheduledContent.save();
    }

    return scheduledContent;
}

module.exports = {
    buildCaption,
    isScheduledItem,
    syncScheduledContent,
};
