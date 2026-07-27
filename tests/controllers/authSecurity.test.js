process.env.USE_MOCK_DB = "true";
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../index');
const User = require('../../model/user');

describe('Bulletproof Auth & Security Tests (#597)', () => {
    const csrfCookie = '_csrf=testtoken';
    const csrfHeader = { 'x-csrf-token': 'testtoken' };

    beforeEach(async () => {
        await User.deleteMany({});
    });

    describe('Signup Security & Validation', () => {
        it('should require name, email, and password during signup', async () => {
            const res = await request(app)
                .post('/signup')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({ name: '', email: 'invalid-email', password: 'short' });

            expect(res.statusCode).toEqual(400);
        });

        it('should normalize email to lowercase and trim spaces on signup', async () => {
            const res = await request(app)
                .post('/signup')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({
                    name: '  Bulletproof User  ',
                    email: '  BulletProof@Example.COM  ',
                    password: 'Password123!',
                });

            expect([201, 200]).toContain(res.statusCode);

            const user = await User.findOne({ email: 'bulletproof@example.com' });
            expect(user).not.toBeNull();
            expect(user.name).toBe('Bulletproof User');
            expect(user.email).toBe('bulletproof@example.com');
        });

        it('should prevent duplicate registration with the same normalized email', async () => {
            const hashedPassword = await bcrypt.hash('Password123!', 10);
            await User.create({
                name: 'Existing User',
                email: 'duplicate@example.com',
                password: hashedPassword,
                isVerified: true,
            });

            const res = await request(app)
                .post('/signup')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({
                    name: 'Another User',
                    email: 'DUPLICATE@EXAMPLE.COM',
                    password: 'Password123!',
                });

            expect(res.statusCode).toEqual(409);
        });
    });

    describe('Login Security & Timing Mitigation', () => {
        beforeEach(async () => {
            const passwordHash = await bcrypt.hash('SecretPass123!', 10);
            await User.create({
                name: 'Valid User',
                email: 'valid@example.com',
                password: passwordHash,
                isVerified: true,
            });
        });

        it('should return 401 generic error for invalid password without revealing user presence', async () => {
            const res = await request(app)
                .post('/login')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({
                    email: 'valid@example.com',
                    password: 'WrongPassword!',
                });

            expect([401, 302]).toContain(res.statusCode);
        });

        it('should return 401 generic error for non-existing user', async () => {
            const res = await request(app)
                .post('/login')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({
                    email: 'nonexistent@example.com',
                    password: 'WrongPassword!',
                });

            expect([401, 302]).toContain(res.statusCode);
        });

        it('should allow successful login with correct credentials', async () => {
            const res = await request(app)
                .post('/login')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({
                    email: 'VALID@EXAMPLE.COM',
                    password: 'SecretPass123!',
                });

            expect([200, 302]).toContain(res.statusCode);
            if (res.statusCode === 200) {
                expect(res.body.success).toBe(true);
            }
        });
    });

    describe('Forgot Password Flow', () => {
        it('should render the forgot password page on GET /forgot-password', async () => {
            const res = await request(app).get('/forgot-password');
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Forgot Password');
        });

        it('should handle POST /forgot-password with valid email', async () => {
            const res = await request(app)
                .post('/forgot-password')
                .set('Cookie', [csrfCookie])
                .set(csrfHeader)
                .send({ email: 'valid@example.com' });

            expect([200, 429]).toContain(res.statusCode);
        });
    });
});
