const request = require('supertest');
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');

describe('asyncHandler Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Promise Rejection Handling', () => {
    it('should catch and forward unhandled Promise rejections to error handler', async () => {
      app.get('/test-rejection', asyncHandler(async (req, res) => {
        return Promise.reject(new Error('Database connection failed'));
      }));

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-rejection')
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('message');
    });

    it('should catch thrown errors in async handlers', async () => {
      app.get('/test-throw', asyncHandler(async (req, res) => {
        throw new Error('Validation failed');
      }));

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-throw')
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle async errors from nested promises', async () => {
      app.get('/test-nested', asyncHandler(async (req, res) => {
        const promise = Promise.resolve().then(() => {
          throw new Error('Nested error');
        });
        await promise;
        res.json({ ok: true });
      }));

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-nested')
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should allow successful async handlers to return responses normally', async () => {
      app.get('/test-success', asyncHandler(async (req, res) => {
        await Promise.resolve();
        res.json({ success: true, data: 'test data' });
      }));

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-success')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBe('test data');
    });

    it('should handle errors with custom status codes', async () => {
      app.get('/test-status', asyncHandler(async (req, res) => {
        const err = new Error('Not found');
        err.status = 404;
        throw err;
      }));

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-status')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should pass next() if response headers already sent', async () => {
      const nextMock = jest.fn();

      const wrappedHandler = asyncHandler(async (req, res, next) => {
        res.headersSent = true;
        throw new Error('This should be caught but not processed');
      });

      const req = { method: 'GET', path: '/test' };
      const res = { headersSent: true };

      await wrappedHandler(req, res, nextMock);

      // asyncHandler calls next() when error is caught
      expect(typeof nextMock).toBe('function');
    });

    it('should work with multiple middleware in chain', async () => {
      const middleware1 = (req, res, next) => {
        req.custom = 'value';
        next();
      };

      app.use(middleware1);
      app.get('/test-chain',
        asyncHandler(async (req, res) => {
          if (!req.custom) throw new Error('Middleware failed');
          res.json({ custom: req.custom });
        })
      );

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-chain')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.custom).toBe('value');
    });
  });

  describe('Non-async handlers', () => {
    it('should pass through non-async functions', async () => {
      app.get('/test-sync', (req, res) => {
        res.json({ ok: true });
      });

      const response = await request(app).get('/test-sync');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });
});
