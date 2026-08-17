process.env.USE_MOCK_DB = "true";
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../index');
const User = require('../../model/user');
const BioProfile = require('../../model/bioProfile');
const { validateHandle, RESERVED_HANDLES } = require('../../controller/bioController');

describe('Bio Controller & Dynamic Routing', () => {
    const csrfCookie = '_csrf=testtoken';
    const csrfHeader = { 'x-csrf-token': 'testtoken' };
    let authCookie;
    let testUser;

    beforeAll(async () => {
        await User.deleteMany({});
        await BioProfile.deleteMany({});

        const password = await bcrypt.hash('Password123!', 10);
        testUser = await User.create({
            name: 'Creator Tester',
            email: 'creator@test.com',
            password,
            isVerified: true,
            alias: 'creator-tester'
        });

        const res = await request(app)
            .post('/login')
            .set('Cookie', [csrfCookie])
            .set(csrfHeader)
            .send({ email: 'creator@test.com', password: 'Password123!' });

        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
            authCookie = setCookie.find(c => c.startsWith('token='));
        }
    });

    describe('validateHandle Unit Logic', () => {
        it('should reject empty or missing handles', () => {
            expect(validateHandle('').valid).toBe(false);
            expect(validateHandle(null).valid).toBe(false);
        });

        it('should reject reserved handle keywords', () => {
            expect(validateHandle('admin').valid).toBe(false);
            expect(validateHandle('login').valid).toBe(false);
            expect(validateHandle('dashboard').valid).toBe(false);
            expect(validateHandle('api').valid).toBe(false);
        });

        it('should reject handles with invalid characters or incorrect length', () => {
            expect(validateHandle('ab').valid).toBe(false); // too short
            expect(validateHandle('hello world!').valid).toBe(false); // spaces/punctuation
            expect(validateHandle('a'.repeat(35)).valid).toBe(false); // too long
        });

        it('should validate and sanitize clean handles', () => {
            const res = validateHandle(' @Awesome_Creator-99 ');
            expect(res.valid).toBe(true);
            expect(res.clean).toBe('awesome_creator-99');
        });
    });

    describe('Bio Save & Profile Management', () => {
        it('should save a new bio profile via POST /bio/save', async () => {
            const cookies = authCookie ? [csrfCookie, authCookie] : [csrfCookie];

            const res = await request(app)
                .post('/bio/save')
                .set('Cookie', cookies)
                .set(csrfHeader)
                .send({
                    handle: 'mybiolink',
                    name: 'Awesome Creator',
                    bio: 'Welcome to my official creator bio page!',
                    tags: ['Tech', 'Design'],
                    theme: 'neon',
                    layout: 'grid',
                    links: [
                        { label: 'My Youtube', url: 'https://youtube.com/mychannel', icon: '🎥', category: 'social' },
                        { label: 'My Website', url: 'https://creator.com', icon: '🌐', category: 'work' }
                    ]
                });

            expect([200, 302]).toContain(res.statusCode);
            if (res.statusCode === 200) {
                expect(res.body.success).toBe(true);
                expect(res.body.data.handle).toBe('mybiolink');
                expect(res.body.data.theme).toBe('neon');
                expect(res.body.data.layout).toBe('grid');
                expect(res.body.data.links.length).toBe(2);
            }
        });

        it('should check handle availability via GET /bio/check-handle/:handle', async () => {
            const cookies = authCookie ? [csrfCookie, authCookie] : [csrfCookie];

            const resAvailable = await request(app)
                .get('/bio/check-handle/brandnewhandle')
                .set('Cookie', cookies);

            expect(resAvailable.statusCode).toBe(200);
            expect(resAvailable.body.available).toBe(true);

            const resReserved = await request(app)
                .get('/bio/check-handle/admin')
                .set('Cookie', cookies);

            expect(resReserved.statusCode).toBe(200);
            expect(resReserved.body.available).toBe(false);
        });
    });

    describe('Dynamic Routing & Link Tracking', () => {
        beforeAll(async () => {
            // Seed a profile directly in Mongo to ensure deterministic tests
            await BioProfile.findOneAndUpdate(
                { userId: testUser._id },
                {
                    userId: testUser._id,
                    handle: 'testcreator',
                    name: 'Test Creator',
                    bio: 'Creator Bio Description',
                    tags: ['Developer'],
                    theme: 'gradient',
                    layout: 'cards',
                    links: [
                        { label: 'GitHub Profile', url: 'https://github.com', icon: '💻', clicks: 0, isEnabled: true }
                    ],
                    stats: { views: 10, clicks: 5, links: 1 }
                },
                { upsert: true, new: true }
            );
        });

        it('should render public profile via /@:handle', async () => {
            const res = await request(app).get('/@testcreator');
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Test Creator');
            expect(res.text).toContain('GitHub Profile');
        });

        it('should render public profile via /bio/:handle', async () => {
            const res = await request(app).get('/bio/testcreator');
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Test Creator');
        });

        it('should render public profile via /u/:handle', async () => {
            const res = await request(app).get('/u/testcreator');
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Test Creator');
        });

        it('should render public profile via fallback route /:handle', async () => {
            const res = await request(app).get('/testcreator');
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Test Creator');
        });

        it('should return 404 for non-existent handles', async () => {
            const res = await request(app).get('/@nonexistenthandle123456');
            expect(res.statusCode).toBe(404);
        });

        it('should track link clicks via POST /bio/track/:linkId', async () => {
            const profile = await BioProfile.findOne({ handle: 'testcreator' });
            expect(profile).toBeDefined();
            const linkId = profile.links[0]._id;

            const res = await request(app)
                .post(`/bio/track/${linkId}`)
                .set('Cookie', [csrfCookie])
                .set(csrfHeader);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            const updatedProfile = await BioProfile.findOne({ handle: 'testcreator' });
            expect(updatedProfile.stats.clicks).toBeGreaterThan(5);
        });
    });
});
