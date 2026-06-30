process.env.USE_MOCK_DB = "true";
const mongoose = require('mongoose');
const { getDashboardData } = require('../utils/dashboardHelper');
const Url = require('../model/url');

describe('Dashboard Data Isolation', () => {
    it('should not show User B URLs when fetching dashboard data for User A', async () => {
        const userAId = new mongoose.Types.ObjectId();
        const userBId = new mongoose.Types.ObjectId();

        await Url.create({ shortId: 'user-a-link', redirectUrl: 'https://a.com', userId: userAId });
        await Url.create({ shortId: 'user-b-link', redirectUrl: 'https://b.com', userId: userBId });

        const userADoc = { _id: userAId, createdAt: new Date() };
        const data = await getDashboardData(userADoc);

        const userBLink = data.recentLinks.find(l => l.shortUrl === 'user-b-link');
        expect(userBLink).toBeUndefined();

        const userALink = data.recentLinks.find(l => l.shortUrl === 'user-a-link');
        expect(userALink).toBeDefined();
        expect(userALink.originalUrl).toBe('https://a.com');
    });
});
