const express = require('express');
const request = require('supertest');

const { sanitizeNoSqlQuery } = require('../../middleware/validators/common');

describe('NoSQL Query Sanitization', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Mount without custom array so it uses the defaults we updated
        app.get('/test', sanitizeNoSqlQuery(), (req, res) => {
            res.json({ query: req.query });
        });
    });

    it('removes NoSQL operators passed as objects (e.g., $ne, $regex) to prevent injection', async () => {
        const res = await request(app).get('/test').query({ status: { $ne: 'draft' }, search: { $regex: 'x' } });
        
        expect(res.status).toBe(200);
        // The middleware removes the object, so status becomes undefined
        expect(res.body.query.status).toBeUndefined();
        expect(res.body.query.search).toBeUndefined();
    });
});
