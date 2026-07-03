const schedule = require('node-schedule');
const connectDB = require('../connect');

const Content = require('../model/content');

async function publishDueContent() {
    try {
        await connectDB();

        const now = new Date();

        const dueContent = await Content.find({
            status: 'scheduled',
            scheduledAt: { $lte: now },
        });

        if (dueContent.length === 0) {
            return;
        }

        console.log(`[ContentScheduling] Found ${dueContent.length} content item(s) due for publishing`);

        for (const item of dueContent) {
            try {
                item.status = 'published';
                item.publishedAt = new Date();
                await item.save();
                console.log(`[ContentScheduling] Published content ${item._id}`);
            } catch (error) {
                console.error(`[ContentScheduling] Error publishing content ${item._id}:`, error);
            }
        }
    } catch (error) {
        console.error('[ContentScheduling] Error in scheduling worker:', error);
    }
}

if (process.env.DISABLE_CONTENT_SCHEDULING !== 'true') {
    schedule.scheduleJob('* * * * *', publishDueContent);
    console.log('✓ Content scheduling worker initialized (runs every minute)');
} else {
    console.warn('⊘ Content scheduling worker disabled (DISABLE_CONTENT_SCHEDULING=true)');
}

module.exports = { publishDueContent };
