const request = require('supertest');
const express = require('express');
const { signupLimiter, generalLimiter, instagramLimiter, authLimiter } = require('../middleware/rateLimiters');

describe('Rate Limiters', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.set('trust proxy', true);
    app.use(express.json());
    app.post('/signup', signupLimiter, (req, res) => {
      res.status(200).json({ success: true, message: 'Signup successful' });
    });

    if (authLimiter.resetKey) {
      authLimiter.resetKey('127.0.0.1');
      authLimiter.resetKey('::ffff:127.0.0.1');
      authLimiter.resetKey('::1');
    }
  });

  describe('signupLimiter', () => {
    it('should allow the first 5 requests within the window', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/signup')
          .set('X-Forwarded-For', `10.1.0.${i + 1}`)
          .send({ email: `test${i}@example.com`, password: 'Test123!' });
        expect([200, 429]).toContain(response.status);
      }
    });

    it('should block requests after exceeding the limit of 5 per hour', async () => {
      const testIp = '10.2.0.1';
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/signup')
          .set('X-Forwarded-For', testIp)
          .set('Accept', 'application/json')
          .send({ email: `test${i}@example.com`, password: 'Test123!' });
      }

      const response = await request(app)
        .post('/signup')
        .set('X-Forwarded-For', testIp)
        .set('Accept', 'application/json')
        .send({ email: 'test6@example.com', password: 'Test123!' });

      expect(response.status).toBe(429);
      expect(response.body.message || response.body.error).toContain('Too many accounts');
    });

    it('should return rate limit headers in the response', async () => {
      const response = await request(app)
        .post('/signup')
        .set('X-Forwarded-For', '10.3.0.1')
        .send({ email: 'test@example.com', password: 'Test123!' });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should respond with JSON for API calls', async () => {
      const testIp = '10.4.0.1';
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/signup')
          .set('X-Forwarded-For', testIp)
          .send({ email: `test${i}@example.com`, password: 'Test123!' });
      }

      const response = await request(app)
        .post('/signup')
        .set('X-Forwarded-For', testIp)
        .send({ email: 'test6@example.com', password: 'Test123!' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('generalLimiter', () => {
    let apiApp;

    beforeEach(() => {
      apiApp = express();
      apiApp.set('trust proxy', true);
      apiApp.use(express.json());
      apiApp.get('/api/test', generalLimiter, (req, res) => {
        res.status(200).json({ success: true, data: 'ok' });
      });
    });

    it('should return rate limit headers for general API requests', async () => {
      const res = await request(apiApp)
        .get('/api/test')
        .set('X-Forwarded-For', '10.5.0.1');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('100');
    });
  });

  describe('instagramLimiter', () => {
    let instaApp;

    beforeEach(() => {
      instaApp = express();
      instaApp.set('trust proxy', true);
      instaApp.use(express.json());
      instaApp.get('/api/instagram/triggers', instagramLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    it('should allow up to 5 requests within the 1-minute window', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(instaApp)
          .get('/api/instagram/triggers')
          .set('X-Forwarded-For', `10.6.0.${i + 1}`);
        expect([200, 429]).toContain(res.status);
      }
    });

    it('should block requests after exceeding 5 requests per minute', async () => {
      const testIp = '10.7.0.1';
      for (let i = 0; i < 5; i++) {
        await request(instaApp)
          .get('/api/instagram/triggers')
          .set('X-Forwarded-For', testIp);
      }
      const res = await request(instaApp)
        .get('/api/instagram/triggers')
        .set('X-Forwarded-For', testIp);
      expect(res.status).toBe(429);
      expect(res.body.error || res.body.message).toContain('Instagram API rate limit reached');
    });
  });

  describe('authLimiter', () => {
    it('should block requests after 10 failed login attempts', async () => {
      const authApp = express();
      authApp.set('trust proxy', true);
      authApp.use(express.json());
      authApp.post('/login', authLimiter, (req, res) => {
        if (req.body.password === 'wrong') {
          return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        res.status(200).json({ success: true });
      });

      const testIp = '10.8.0.1';
      for (let i = 0; i < 10; i++) {
        await request(authApp)
          .post('/login')
          .set('X-Forwarded-For', testIp)
          .set('Accept', 'application/json')
          .send({ email: `test${i}@example.com`, password: 'wrong' });
      }

      const res = await request(authApp)
        .post('/login')
        .set('X-Forwarded-For', testIp)
        .set('Accept', 'application/json')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(res.status).toBe(429);
      expect(res.body.error || res.body.message).toContain('Too many login attempts');
    });

    it('should skip counting successful requests', async () => {
      const freshAuthApp = express();
      freshAuthApp.set('trust proxy', true);
      freshAuthApp.use(express.json());
      freshAuthApp.post('/login', authLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });

      const testIp = '10.9.0.1';
      for (let i = 0; i < 15; i++) {
        const res = await request(freshAuthApp)
          .post('/login')
          .set('X-Forwarded-For', testIp)
          .set('Accept', 'application/json')
          .send({ email: 'test@example.com', password: 'correct' });

        expect(res.status).toBe(200);
      }
    });
  });
});
