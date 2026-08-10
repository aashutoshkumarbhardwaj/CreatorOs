const express = require('express');
const request = require('supertest');

jest.mock('passport', () => ({
    use: jest.fn(),
    authenticate: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../controller/auth', () => ({
    signup: jest.fn(),
    login: jest.fn(),
    handleGoogleCallback: jest.fn(),
  verifyLogin2FA: jest.fn(),
    loginAsContributor: jest.fn((req, res) => res.status(200).json({ success: true })),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
}));

jest.mock('../../middleware/rateLimiters', () => ({
    loginLimiter: (req, res, next) => next(),
    signupLimiter: (req, res, next) => next(),
    emailVerificationLimiter: (req, res, next) => next(),
    forgotPasswordLimiter: (req, res, next) => next(),
    resetPasswordLimiter: (req, res, next) => next(),
}));

jest.mock('../../connect', () => jest.fn());
jest.mock('../../model/passwordResetToken', () => ({
    findOne: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../model/user', () => ({
    findOne: jest.fn().mockResolvedValue(null),
}));

describe('contributor login routes', () => {
    let app;

    beforeEach(() => {
        jest.resetModules();
        app = express();
        app.use(express.json());
        app.set('view engine', 'ejs');
        app.response.render = function render(view, locals) {
            return this.status(200).json({ view, locals });
        };
        app.use(require('../../routes/auth'));
    });

    test.each(['/login/contributor', '/api/auth/contributor-login'])(
        'allows %s without creator credentials',
        async (path) => {
            const res = await request(app).post(path).send({});

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true });
        }
    );
});
