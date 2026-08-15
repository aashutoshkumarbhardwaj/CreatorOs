const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const DmTrigger = require('../../model/dmTrigger');

const USER_A = new mongoose.Types.ObjectId().toString();
const USER_B = new mongoose.Types.ObjectId().toString();

const mockProtect = jest.fn((req, res, next) => {
    req.user = { id: USER_A };
    next();
});

jest.mock('../../middleware/auth', () => ({
    protect: mockProtect,
}));

jest.mock('../../middleware/rateLimiters', () => ({
    instagramProfileLimiter: (req, res, next) => next(),
}));

jest.mock('../../controller/instagramController', () => ({
    getInstagramProfile: jest.fn(),
}));

jest.mock('../../controller/instagramWebhookController', () => ({
    verifyWebhook: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    handleWebhook: jest.fn(),
}));

const instagramRoutes = require('../../routes/instagram');

const app = express();
app.use(express.json());
app.use('/api/instagram', instagramRoutes);

describe('Instagram DM trigger routes', () => {
    beforeEach(async () => {
        await DmTrigger.deleteMany({});
    });

    it('lists only the authenticated user\'s triggers', async () => {
        await DmTrigger.create([
            { creatorId: USER_A, keyword: 'alpha', responseUrl: 'https://a.example' },
            { creatorId: USER_B, keyword: 'beta', responseUrl: 'https://b.example' },
        ]);

        const res = await request(app).get('/api/instagram/triggers');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].creatorId.toString()).toBe(USER_A);
    });

    it('cannot delete another user\'s trigger', async () => {
        const other = await DmTrigger.create({ creatorId: USER_B, keyword: 'beta', responseUrl: 'https://b.example' });

        const res = await request(app).delete(`/api/instagram/triggers/${other._id}`);

        expect(res.status).toBe(404);
        expect(await DmTrigger.findById(other._id)).not.toBeNull();
    });

    it('deletes the authenticated user\'s own trigger', async () => {
        const own = await DmTrigger.create({ creatorId: USER_A, keyword: 'alpha', responseUrl: 'https://a.example' });

        const res = await request(app).delete(`/api/instagram/triggers/${own._id}`);

        expect(res.status).toBe(200);
        expect(await DmTrigger.findById(own._id)).toBeNull();
    });
});
