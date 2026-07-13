process.env.USE_MOCK_DB = "true";
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../index');
const User = require('../../model/user');

describe('Auth Controller Endpoints', () => {
    const csrfCookie = '_csrf=testtoken';
    const csrfHeader = { 'x-csrf-token': 'testtoken' };

    beforeEach(async () => {
        await User.deleteMany({});

        const verifiedPassword = await bcrypt.hash('Password123!', 10);
        await User.create({
            name: 'Verified User',
            email: 'test@local.com',
            password: verifiedPassword,
            isVerified: true,
        });

        const unverifiedPassword = await bcrypt.hash('Password123!', 10);
        await User.create({
            name: 'Unverified User',
            email: 'unverified@local.com',
            password: unverifiedPassword,
            isVerified: false,
        });
    });

    it('should get the signup page', async () => {
        const res = await request(app).get('/signup');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('<form');
    });

    it('should return 400 for invalid signup data (input validation)', async () => {
        const res = await request(app)
            .post('/signup')
            .set('Cookie', [csrfCookie])
            .set(csrfHeader)
            .send({ email: 'bademail' });
        
        expect(res.statusCode).toEqual(400);
    });

    it('should successfully log in a mock user', async () => {
        const res = await request(app)
            .post('/login')
            .set('Cookie', [csrfCookie])
            .set(csrfHeader)
            .send({ email: 'test@local.com', password: 'Password123!' });
        
        expect([200, 302]).toContain(res.statusCode);
        if (res.statusCode === 200) {
            expect(res.body.success).toBe(true);
        }
    });

    it('should redirect unverified users to resend verification when email verification is configured', async () => {
        const originalEmailEnv = {
            EMAIL_USER: process.env.EMAIL_USER,
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
            EMAIL_SERVICE: process.env.EMAIL_SERVICE,
            EMAIL_HOST: process.env.EMAIL_HOST,
        };

        process.env.EMAIL_USER = 'tester@example.com';
        process.env.EMAIL_PASSWORD = 'password';
        process.env.EMAIL_SERVICE = 'smtp';
        delete process.env.EMAIL_HOST;

        try {
            const res = await request(app)
                .post('/login')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({ email: 'unverified@local.com', password: 'Password123!' });

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('/resend-verification');
        } finally {
            process.env.EMAIL_USER = originalEmailEnv.EMAIL_USER;
            process.env.EMAIL_PASSWORD = originalEmailEnv.EMAIL_PASSWORD;
            process.env.EMAIL_SERVICE = originalEmailEnv.EMAIL_SERVICE;
            process.env.EMAIL_HOST = originalEmailEnv.EMAIL_HOST;
        }
    });

    it('should redirect unverified users to resend verification when email verification is not configured', async () => {
        const originalEmailEnv = {
            EMAIL_USER: process.env.EMAIL_USER,
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
            EMAIL_SERVICE: process.env.EMAIL_SERVICE,
            EMAIL_HOST: process.env.EMAIL_HOST,
        };

        delete process.env.EMAIL_USER;
        delete process.env.EMAIL_PASSWORD;
        delete process.env.EMAIL_SERVICE;
        delete process.env.EMAIL_HOST;

        try {
            const res = await request(app)
                .post('/login')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({ email: 'unverified@local.com', password: 'Password123!' });

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('/resend-verification');
        } finally {
            process.env.EMAIL_USER = originalEmailEnv.EMAIL_USER;
            process.env.EMAIL_PASSWORD = originalEmailEnv.EMAIL_PASSWORD;
            process.env.EMAIL_SERVICE = originalEmailEnv.EMAIL_SERVICE;
            process.env.EMAIL_HOST = originalEmailEnv.EMAIL_HOST;
        }
    });

    it('should allow login after returning from resend-verification when delivery is unavailable', async () => {
        const originalEmailEnv = {
            EMAIL_USER: process.env.EMAIL_USER,
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
            EMAIL_SERVICE: process.env.EMAIL_SERVICE,
            EMAIL_HOST: process.env.EMAIL_HOST,
        };

        delete process.env.EMAIL_USER;
        delete process.env.EMAIL_PASSWORD;
        delete process.env.EMAIL_SERVICE;
        delete process.env.EMAIL_HOST;

        try {
            const res = await request(app)
                .post('/login')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({
                    email: 'unverified@local.com',
                    password: 'Password123!',
                    allowUnverifiedLogin: '1',
                });

            expect([200, 302]).toContain(res.statusCode);
            if (res.statusCode === 200) {
                expect(res.body.success).toBe(true);
            } else {
                expect(res.headers.location).toContain('/dashboard');
            }
        } finally {
            process.env.EMAIL_USER = originalEmailEnv.EMAIL_USER;
            process.env.EMAIL_PASSWORD = originalEmailEnv.EMAIL_PASSWORD;
            process.env.EMAIL_SERVICE = originalEmailEnv.EMAIL_SERVICE;
            process.env.EMAIL_HOST = originalEmailEnv.EMAIL_HOST;
        }
    });

    it('should show resend verification as unavailable when email delivery is not configured', async () => {
        const res = await request(app)
            .get('/resend-verification')
            .query({ email: 'unverified@local.com', delivery: 'unavailable' });

        expect(res.statusCode).toBe(200);
        expect(res.text).toMatch(/email verification is temporarily unavailable/i);
    });

    it('should get the login page', async () => {
        const res = await request(app).get('/login');
        expect(res.statusCode).toEqual(200);
    });
});
