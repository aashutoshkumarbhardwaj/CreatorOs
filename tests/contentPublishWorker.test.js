const mongoose = require('mongoose');
const { publishDueContent } = require('../workers/contentPublishWorker');
const ScheduledContent = require('../model/scheduledContent');

describe('Content Publish Worker', () => {
    it('publishes content whose scheduledAt has passed and updates status/publishedAt', async () => {
        const userId = new mongoose.Types.ObjectId();
        const dueItem = await ScheduledContent.create({
            userId,
            caption: 'Due for publishing',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 60 * 1000), // 1 minute in the past
            status: 'scheduled',
        });

        const publishedCount = await publishDueContent();
        expect(publishedCount).toBe(1);

        const refreshed = await ScheduledContent.findById(dueItem._id);
        expect(refreshed.status).toBe('published');
        expect(refreshed.publishedAt).toBeInstanceOf(Date);
    });

    it('does not publish content scheduled in the future', async () => {
        const userId = new mongoose.Types.ObjectId();
        const futureItem = await ScheduledContent.create({
            userId,
            caption: 'Not due yet',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            status: 'scheduled',
        });

        await publishDueContent();

        const refreshed = await ScheduledContent.findById(futureItem._id);
        expect(refreshed.status).toBe('scheduled');
        expect(refreshed.publishedAt).toBeUndefined();
    });

    it('does not re-publish content that is already published or cancelled', async () => {
        const userId = new mongoose.Types.ObjectId();
        const alreadyPublished = await ScheduledContent.create({
            userId,
            caption: 'Already published',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 60 * 1000),
            status: 'published',
            publishedAt: new Date(Date.now() - 30 * 1000),
        });
        const cancelled = await ScheduledContent.create({
            userId,
            caption: 'Cancelled',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 60 * 1000),
            status: 'cancelled',
        });

        const publishedCount = await publishDueContent();
        expect(publishedCount).toBe(0);

        expect((await ScheduledContent.findById(alreadyPublished._id)).status).toBe('published');
        expect((await ScheduledContent.findById(cancelled._id)).status).toBe('cancelled');
    });

    it('respects the configured batch size for large due backlogs', async () => {
        const userId = new mongoose.Types.ObjectId();
        const dueItems = await ScheduledContent.insertMany([
            {
                userId,
                caption: 'Backlog item 1',
                timezone: 'UTC',
                scheduledAt: new Date(Date.now() - 3 * 60 * 1000),
                status: 'scheduled',
            },
            {
                userId,
                caption: 'Backlog item 2',
                timezone: 'UTC',
                scheduledAt: new Date(Date.now() - 2 * 60 * 1000),
                status: 'scheduled',
            },
            {
                userId,
                caption: 'Backlog item 3',
                timezone: 'UTC',
                scheduledAt: new Date(Date.now() - 60 * 1000),
                status: 'scheduled',
            },
        ]);

        const publishedCount = await publishDueContent({ batchSize: 2 });

        expect(publishedCount).toBe(2);

        const refreshed = await ScheduledContent.find({
            _id: { $in: dueItems.map((item) => item._id) },
        }).sort({ scheduledAt: 1 });

        expect(refreshed.filter((item) => item.status === 'published')).toHaveLength(2);
        expect(refreshed.filter((item) => item.status === 'scheduled')).toHaveLength(1);
    });
});
