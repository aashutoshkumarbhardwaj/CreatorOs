const express = require('express');
const request = require('supertest');

jest.mock('../../controller/taskController');
jest.mock('../../controller/smartNotificationController');
jest.mock('../../controller/contentOsController');

jest.mock('../../middleware/auth', () => ({
    protect: (req, res, next) => next(),
    preventContributorWrites: (req, res, next) => next(),
}));

jest.mock('../../middleware/rateLimiters', () => ({
    aiGenerationLimiter: (req, res, next) => next(),
    // mock any other limiters if needed
}));

const taskController = require('../../controller/taskController');
const smartNotificationController = require('../../controller/smartNotificationController');
const contentOsController = require('../../controller/contentOsController');

const taskRoutes = require('../../routes/taskRoutes');
const smartNotificationRoutes = require('../../routes/smartNotificationRoutes');
const contentOsRoutes = require('../../routes/contentOsRoutes');

describe('NoSQL Query Sanitization on Production Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.set('query parser', 'extended'); // Explicitly test with extended parser to verify sanitization
        app.use(express.json());
        
        taskController.getTasks.mockImplementation((req, res) => res.json({ query: req.query }));
        smartNotificationController.getNotifications.mockImplementation((req, res) => res.json({ query: req.query }));
        contentOsController.listItems.mockImplementation((req, res) => res.json({ query: req.query }));

        // Mount routers
        app.use(taskRoutes);
        app.use(smartNotificationRoutes);
        app.use(contentOsRoutes);
        
        taskController.getTasks.mockClear();
        smartNotificationController.getNotifications.mockClear();
        contentOsController.listItems.mockClear();
    });

    it('sanitizes NoSQL operators from GET /api/tasks', async () => {
        const res = await request(app).get('/api/tasks').query({ status: { $ne: 'draft' }, isArchived: { $ne: 'true' } });
        expect(res.status).toBe(200);
        expect(res.body.query.status).toBeUndefined();
        expect(res.body.query.isArchived).toBeUndefined();
    });

    it('sanitizes NoSQL operators from GET /api/notifications', async () => {
        const res = await request(app).get('/api/notifications').query({ type: { $ne: 'alert' }, page: { $gt: '1' } });
        expect(res.status).toBe(200);
        expect(res.body.query.type).toBeUndefined();
        expect(res.body.query.page).toBeUndefined();
    });

    it('sanitizes NoSQL operators from GET /api/items', async () => {
        const res = await request(app).get('/api/items').query({ category: { $ne: 'video' }, limit: { $gt: '50' } });
        expect(res.status).toBe(200);
        expect(res.body.query.category).toBeUndefined();
        expect(res.body.query.limit).toBeUndefined();
    });
    
    it('allows scalar values on GET /api/tasks', async () => {
        const res = await request(app).get('/api/tasks').query({ status: 'draft', isArchived: 'false', page: '2' });
        expect(res.status).toBe(200);
        expect(res.body.query.status).toBe('draft');
        expect(res.body.query.isArchived).toBe('false');
        expect(res.body.query.page).toBe('2');
    });
});
