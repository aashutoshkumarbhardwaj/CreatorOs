const request = require('supertest');
const express = require('express');
const errorHandler = require('../middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Route that throws an error
    app.get('/test-error', (req, res, next) => {
      const err = new Error('Database connection failed');
      err.status = 500;
      next(err);
    });

    // Route that throws a client error
    app.get('/test-validation-error', (req, res, next) => {
      const err = new Error('Validation failed: invalid email format');
      err.status = 400;
      next(err);
    });

    // Route that throws error with full stack
    app.get('/test-stack-error', (req, res, next) => {
      try {
        throw new Error('Test error with stack trace');
      } catch (err) {
        err.status = 500;
        next(err);
      }
    });

    app.use(errorHandler);
  });

  describe('Production mode (NODE_ENV=production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should not expose stack traces for 5xx errors', async () => {
      const response = await request(app)
        .get('/test-error')
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'An internal error occurred.',
        error: 'An internal error occurred.'
      });

      expect(response.body).not.toHaveProperty('stack');
      expect(JSON.stringify(response.body)).not.toMatch(/\/middleware|errorHandler|Database connection/);
    });

    it('should sanitize client error messages', async () => {
      const response = await request(app)
        .get('/test-validation-error')
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/validation|invalid/i);
      expect(response.body.message).not.toMatch(/\bfrom\b|\/home|\/tmp|\.js:/);
    });

    it('should not expose error details in JSON response', async () => {
      const response = await request(app)
        .get('/test-stack-error')
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toMatch(/at /);
      expect(JSON.stringify(response.body)).not.toMatch(/\(/);
    });
  });

  describe('Development mode (NODE_ENV=development)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should expose error messages for debugging', async () => {
      const response = await request(app)
        .get('/test-error')
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Database connection failed');
    });

    it('should not expose stack traces in JSON response even in development', async () => {
      const response = await request(app)
        .get('/test-stack-error')
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toHaveProperty('stack');
      expect(JSON.stringify(response.body)).not.toMatch(/at /);
    });
  });

  it('should not process errors if headers already sent', (done) => {
    const appWithHeadersSent = express();
    appWithHeadersSent.use(express.json());

    appWithHeadersSent.get('/test', (req, res, next) => {
      res.status(200).send('OK');
      const err = new Error('This should not be sent');
      next(err);
    });

    appWithHeadersSent.use(errorHandler);

    request(appWithHeadersSent)
      .get('/test')
      .end((err, res) => {
        expect(res.status).toBe(200);
        expect(res.text).toBe('OK');
        done();
      });
  });
});
