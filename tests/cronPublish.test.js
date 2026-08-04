const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = require('../index');
const ScheduledContent = require('../model/scheduledContent');

describe('Vercel Cron Content Publishing', () => {
    it('declares cron path in vercel.json pointing to /api/cron/publish-content', () => {
        const vercelJsonPath = path.join(__dirname, '../vercel.json');
        const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));

        expect(vercelConfig.crons).toBeDefined();
        expect(Array.isArray(vercelConfig.crons)).toBe(true);
        const cronEntry = vercelConfig.crons.find(c => c.path === '/api/cron/publish-content');
        expect(cronEntry).toBeDefined();
        expect(cronEntry.schedule).toBe('* * * * *');
    });

    it('rejects unauthorized requests when CRON_SECRET is configured', async () => {
        process.env.CRON_SECRET = 'super-secret-cron-key';
        try {
            const res = await request(app)
                .get('/api/cron/publish-content')
                .set('Authorization', 'Bearer wrong-key');

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Unauthorized');
        } finally {
            delete process.env.CRON_SECRET;
        }
    });

    it('processes due scheduled content and is idempotent on repeat calls', async () => {
        const userId = new mongoose.Types.ObjectId();
        const dueItem = await ScheduledContent.create({
            userId,
            caption: 'Cron publish test due',
            timezone: 'UTC',
            scheduledAt: new Date(Date.now() - 60 * 1000),
            status: 'scheduled',
        });

        // First invocation - should publish item
        const res1 = await request(app).get('/api/cron/publish-content');
        expect(res1.status).toBe(200);
        expect(res1.body.success).toBe(true);
        expect(res1.body.publishedCount).toBe(1);

        const refreshed = await ScheduledContent.findById(dueItem._id);
        expect(refreshed.status).toBe('published');
        expect(refreshed.publishedAt).toBeInstanceOf(Date);

        // Second invocation - should return 0 published items (idempotent)
        const res2 = await request(app).get('/api/cron/publish-content');
        expect(res2.status).toBe(200);
        expect(res2.body.publishedCount).toBe(0);
    });
});
