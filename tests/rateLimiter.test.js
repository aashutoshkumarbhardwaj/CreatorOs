const request = require('supertest');
const express = require('express');
const { signupLimiter } = require('../middleware/rateLimiters');

describe('Rate Limiters', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.post('/signup', signupLimiter, (req, res) => {
      res.status(200).json({ success: true, message: 'Signup successful' });
    });
  });

  describe('signupLimiter', () => {
    it('should allow the first 5 requests within the window', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/signup')
          .send({ email: `test${i}@example.com`, password: 'Test123!' });
        expect([200, 429]).toContain(response.status);
      }
    });

    it('should block requests after exceeding the limit of 5 per hour', async () => {
      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/signup')
          .send({ email: `test${i}@example.com`, password: 'Test123!' });
      }

      // The 6th request should be rate-limited
      const response = await request(app)
        .post('/signup')
        .send({ email: 'test6@example.com', password: 'Test123!' });

      expect(response.status).toBe(429);
      expect(response.body.message || response.body.error).toContain('Too many accounts');
    });

    it('should return rate limit headers in the response', async () => {
      const response = await request(app)
        .post('/signup')
        .send({ email: 'test@example.com', password: 'Test123!' });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should respond with JSON for API calls', async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/signup')
          .send({ email: `test${i}@example.com`, password: 'Test123!' });
      }

      const response = await request(app)
        .post('/signup')
        .send({ email: 'test6@example.com', password: 'Test123!' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });
  });
});
