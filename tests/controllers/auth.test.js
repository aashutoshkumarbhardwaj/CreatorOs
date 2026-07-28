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

    it('should successfully sign up a new user with uniform success response', async () => {
        const res = await request(app)
            .post('/signup')
            .set('Cookie', [csrfCookie])
            .set(csrfHeader)
            .set('Accept', 'application/json')
            .send({ name: 'New User', email: 'newuser@local.com', password: 'Password123!' });

        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.email).toBe('newuser@local.com');

        const createdUser = await User.findOne({ email: 'newuser@local.com' });
        expect(createdUser).not.toBeNull();
        expect(createdUser.name).toBe('New User');
    });

    it('should return uniform success response (201) when signing up with an existing email to prevent user enumeration', async () => {
        const preCount = await User.countDocuments({ email: 'test@local.com' });
        expect(preCount).toBe(1);

        const res = await request(app)
            .post('/signup')
            .set('Cookie', [csrfCookie])
            .set(csrfHeader)
            .set('Accept', 'application/json')
            .send({ name: 'Attempter Name', email: 'test@local.com', password: 'NewPassword123!' });

        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.email).toBe('test@local.com');

        const postCount = await User.countDocuments({ email: 'test@local.com' });
        expect(postCount).toBe(1);

        const existingUser = await User.findOne({ email: 'test@local.com' });
        expect(existingUser.name).toBe('Verified User'); // Ensure user was not overwritten
    });

    it('should handle duplicate email signup smoothly when email delivery is configured', async () => {
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
                .post('/signup')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .set('Accept', 'application/json')
                .send({ name: 'Attempter', email: 'test@local.com', password: 'Password123!' });

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.email).toBe('test@local.com');
        } finally {
            process.env.EMAIL_USER = originalEmailEnv.EMAIL_USER;
            process.env.EMAIL_PASSWORD = originalEmailEnv.EMAIL_PASSWORD;
            process.env.EMAIL_SERVICE = originalEmailEnv.EMAIL_SERVICE;
            process.env.EMAIL_HOST = originalEmailEnv.EMAIL_HOST;
        }
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

    it('should issue a 30-day token and cookie when remember is checked, and 7-day when not checked', async () => {
        const jwt = require('jsonwebtoken');

        // Test without remember (default 7 days)
        const resDefault = await request(app)
            .post('/login')
            .set('Cookie', [csrfCookie])
            .set(csrfHeader)
            .send({ email: 'test@local.com', password: 'Password123!' });

        expect([200, 302]).toContain(resDefault.statusCode);
        const setCookieDefault = resDefault.headers['set-cookie'] || [];
        const tokenCookieDefault = setCookieDefault.find(c => c.startsWith('token='));
        expect(tokenCookieDefault).toBeDefined();
        expect(tokenCookieDefault).toContain('Max-Age=604800'); // 7 days in seconds

        // Test with remember checked (30 days)
        const resRemember = await request(app)
            .post('/login')
            .set('Cookie', [csrfCookie])
            .set(csrfHeader)
            .send({ email: 'test@local.com', password: 'Password123!', remember: 'on' });

        expect([200, 302]).toContain(resRemember.statusCode);
        const setCookieRemember = resRemember.headers['set-cookie'] || [];
        const tokenCookieRemember = setCookieRemember.find(c => c.startsWith('token='));
        expect(tokenCookieRemember).toBeDefined();
        expect(tokenCookieRemember).toContain('Max-Age=2592000'); // 30 days in seconds

        const tokenVal = tokenCookieRemember.split(';')[0].split('=')[1];
        const decoded = jwt.decode(tokenVal);
        expect(decoded.exp - decoded.iat).toBe(2592000);
    });

    it('should redirect unverified users to resend verification when email verification is configured', async () => {
        const originalEnv = {
            NODE_ENV: process.env.NODE_ENV,
            EMAIL_USER: process.env.EMAIL_USER,
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
            EMAIL_SERVICE: process.env.EMAIL_SERVICE,
            EMAIL_HOST: process.env.EMAIL_HOST,
            NODE_ENV: process.env.NODE_ENV,
        };

        process.env.NODE_ENV = 'production';
        process.env.EMAIL_USER = 'tester@example.com';
        process.env.EMAIL_PASSWORD = 'password';
        process.env.EMAIL_SERVICE = 'smtp';
        process.env.NODE_ENV = 'production';
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
            process.env.NODE_ENV = originalEnv.NODE_ENV;
            process.env.EMAIL_USER = originalEnv.EMAIL_USER;
            process.env.EMAIL_PASSWORD = originalEnv.EMAIL_PASSWORD;
            process.env.EMAIL_SERVICE = originalEnv.EMAIL_SERVICE;
            process.env.EMAIL_HOST = originalEnv.EMAIL_HOST;
        }
    });

    it('should redirect unverified users to resend verification when email verification is not configured', async () => {
        const originalEnv = {
            NODE_ENV: process.env.NODE_ENV,
            EMAIL_USER: process.env.EMAIL_USER,
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
            EMAIL_SERVICE: process.env.EMAIL_SERVICE,
            EMAIL_HOST: process.env.EMAIL_HOST,
            NODE_ENV: process.env.NODE_ENV,
        };

        process.env.NODE_ENV = 'production';
        delete process.env.EMAIL_USER;
        delete process.env.EMAIL_PASSWORD;
        delete process.env.EMAIL_SERVICE;
        delete process.env.EMAIL_HOST;
        process.env.NODE_ENV = 'production';

        try {
            const res = await request(app)
                .post('/login')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({ email: 'unverified@local.com', password: 'Password123!' });

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('/resend-verification');
        } finally {
            process.env.NODE_ENV = originalEnv.NODE_ENV;
            process.env.EMAIL_USER = originalEnv.EMAIL_USER;
            process.env.EMAIL_PASSWORD = originalEnv.EMAIL_PASSWORD;
            process.env.EMAIL_SERVICE = originalEnv.EMAIL_SERVICE;
            process.env.EMAIL_HOST = originalEnv.EMAIL_HOST;
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

    it('should get the login page when unauthenticated', async () => {
        const res = await request(app).get('/login');
        expect(res.statusCode).toEqual(200);
    });

    it('should redirect authenticated users from / and /login to /dashboard', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id: '123', email: 'test@local.com', role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Unauthenticated should get 200 on /
        const resUnauth = await request(app).get('/');
        expect(resUnauth.statusCode).toBe(200);

        // Authenticated should be redirected from / to /dashboard
        const resAuthHome = await request(app)
            .get('/')
            .set('Cookie', [`token=${token}`]);
        expect(resAuthHome.statusCode).toBe(302);
        expect(resAuthHome.headers.location).toBe('/dashboard');

        // Authenticated should be redirected from /login to /dashboard
        const resAuthLogin = await request(app)
            .get('/login')
            .set('Cookie', [`token=${token}`]);
        expect(resAuthLogin.statusCode).toBe(302);
        expect(resAuthLogin.headers.location).toBe('/dashboard');
    });
});
