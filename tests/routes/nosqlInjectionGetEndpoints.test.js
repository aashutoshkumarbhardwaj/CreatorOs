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

    const allAllowlistedKeys = [
        'q', 'stage', 'category', 'status', 'type', 'platform', 'priority', 
        'search', 'folderId', 'tag', 'isArchived', 'page', 'limit'
    ];

    it('sanitizes ALL allowlisted NoSQL operators from GET /api/tasks', async () => {
        const maliciousQuery = {};
        allAllowlistedKeys.forEach(key => {
            maliciousQuery[key] = { $ne: 'malicious' };
        });

        const res = await request(app).get('/api/tasks').query(maliciousQuery);
        expect(res.status).toBe(200);
        
        allAllowlistedKeys.forEach(key => {
            expect(res.body.query[key]).toBeUndefined();
        });
    });

    it('sanitizes ALL allowlisted NoSQL operators from GET /api/notifications', async () => {
        const maliciousQuery = {};
        allAllowlistedKeys.forEach(key => {
            maliciousQuery[key] = { $gt: '1' };
        });

        const res = await request(app).get('/api/notifications').query(maliciousQuery);
        expect(res.status).toBe(200);
        
        allAllowlistedKeys.forEach(key => {
            expect(res.body.query[key]).toBeUndefined();
        });
    });

    it('sanitizes ALL allowlisted NoSQL operators from GET /api/items', async () => {
        const maliciousQuery = {};
        allAllowlistedKeys.forEach(key => {
            maliciousQuery[key] = { $regex: '.*' };
        });

        const res = await request(app).get('/api/items').query(maliciousQuery);
        expect(res.status).toBe(200);
        
        allAllowlistedKeys.forEach(key => {
            expect(res.body.query[key]).toBeUndefined();
        });
    });
    
    it('allows ALL scalar values on GET /api/tasks', async () => {
        const scalarQuery = {};
        allAllowlistedKeys.forEach(key => {
            scalarQuery[key] = 'valid_value';
        });

        const res = await request(app).get('/api/tasks').query(scalarQuery);
        expect(res.status).toBe(200);
        
        allAllowlistedKeys.forEach(key => {
            expect(res.body.query[key]).toBe('valid_value');
        });
    });
});
