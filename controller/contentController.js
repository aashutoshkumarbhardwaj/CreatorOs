const asyncHandler = require('../utils/asyncHandler');
const Content = require('../model/content');
const { convertToUTC, getUserTimeZone } = require('../utils/timezoneHelper');

const createOrUpdateContent = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        id,
        title,
        body,
        scheduledAt,
        userTimeZone,
        metadata,
        publishNow,
    } = req.body;

    if (!title || !body) {
        return res.status(400).json({
            success: false,
            message: 'Title and body are required',
        });
    }

    let content;
    const contentData = {
        title,
        body,
        metadata: metadata || {},
        userTimeZone: userTimeZone || getUserTimeZone(),
    };

    if (publishNow) {
        contentData.status = 'published';
        contentData.publishedAt = new Date();
    } else if (scheduledAt) {
        const utcScheduledAt = convertToUTC(new Date(scheduledAt), contentData.userTimeZone);
        if (utcScheduledAt <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Scheduled time must be in the future',
            });
        }
        contentData.status = 'scheduled';
        contentData.scheduledAt = utcScheduledAt;
    } else {
        contentData.status = 'draft';
    }

    if (id) {
        content = await Content.findByIdAndUpdate(
            id,
            { $set: contentData },
            { new: true }
        );

        if (!content || content.userId.toString() !== userId) {
            return res.status(404).json({
                success: false,
                message: 'Content not found',
            });
        }
    } else {
        content = await Content.create({
            ...contentData,
            userId,
        });
    }

    return res.status(id ? 200 : 201).json({
        success: true,
        message: id ? 'Content updated' : 'Content created',
        data: content,
    });
});

const getContent = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const content = await Content.findById(id);

    if (!content || content.userId.toString() !== userId) {
        return res.status(404).json({
            success: false,
            message: 'Content not found',
        });
    }

    return res.json({
        success: true,
        data: content,
    });
});

const listContent = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { status, limit = 20, skip = 0 } = req.query;

    const query = { userId };
    if (status) {
        query.status = status;
    }

    const [content, total] = await Promise.all([
        Content.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip)),
        Content.countDocuments(query),
    ]);

    return res.json({
        success: true,
        data: content,
        pagination: {
            total,
            limit: parseInt(limit),
            skip: parseInt(skip),
        },
    });
});

const deleteContent = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const content = await Content.findByIdAndDelete(id);

    if (!content || content.userId.toString() !== userId) {
        return res.status(404).json({
            success: false,
            message: 'Content not found',
        });
    }

    return res.json({
        success: true,
        message: 'Content deleted',
    });
});

const getScheduledContent = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { userTimeZone = 'UTC' } = req.query;

    const scheduledContent = await Content.find({
        userId,
        status: 'scheduled',
    }).sort({ scheduledAt: 1 });

    return res.json({
        success: true,
        data: scheduledContent.map((item) => ({
            ...item.toObject(),
            userTimeZone,
        })),
    });
});

module.exports = {
    createOrUpdateContent,
    getContent,
    listContent,
    deleteContent,
    getScheduledContent,
};
