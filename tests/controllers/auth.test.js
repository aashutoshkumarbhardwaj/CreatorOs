process.env.USE_MOCK_DB = "true";
const request = require('supertest');
const app = require('../../index');

describe('Auth Controller Endpoints', () => {
    const csrfCookie = '_csrf=testtoken';
    const csrfHeader = { 'x-csrf-token': 'testtoken' };

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
        
        // Due to redirect on success or 200 json depending on accepts
        expect([200, 302]).toContain(res.statusCode);
        if (res.statusCode === 200) {
            expect(res.body.success).toBe(true);
        }
    });

    it('should get the login page', async () => {
        const res = await request(app).get('/login');
        expect(res.statusCode).toEqual(200);
    });
});
