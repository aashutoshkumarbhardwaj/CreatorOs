const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../model/user');
const jwt = require('jsonwebtoken');

describe('Settings Billing API', () => {
    let app;

    beforeAll(() => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key';
        process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'test_token';
        process.env.INSTAGRAM_APP_SECRET = 'test_secret';
        process.env.USE_MOCK_DB = 'false';
        app = require('../index');
    });

    it('returns Free plan and empty invoices when user has no subscription data', async () => {
        const userId = new mongoose.Types.ObjectId();
        const email = 'nobilling@example.com';
        const token = jwt.sign(
            { id: userId.toString(), email, role: 'creator', iat: Math.floor(Date.now() / 1000) },
            process.env.JWT_SECRET
        );

        await User.create({
            _id: userId,
            name: 'No Billing User',
            email,
            password: 'hashedpassword',
            isVerified: true,
        });

        const res = await request(app)
            .get('/api/settings/billing')
            .set('Cookie', [`token=${token}`]);

        expect(res.status).toBe(200);
        expect(res.body.planName).toBe('Free');
        expect(res.body.priceMonthly).toBe(0);
        expect(res.body.nextInvoiceLabel).toBe('No upcoming invoice');
        expect(res.body.cardBrand).toBeNull();
        expect(res.body.cardLast4).toBeNull();
        expect(res.body.invoices).toEqual([]);
    });

    it('returns subscription details and invoices when populated', async () => {
        const subUserId = new mongoose.Types.ObjectId();
        const subEmail = 'subscribed@example.com';
        const subToken = jwt.sign(
            { id: subUserId.toString(), email: subEmail, role: 'creator', iat: Math.floor(Date.now() / 1000) },
            process.env.JWT_SECRET
        );

        await User.create({
            _id: subUserId,
            name: 'Subscribed User',
            email: subEmail,
            password: 'hashedpassword',
            isVerified: true,
            subscription: {
                status: 'active',
                planName: 'Pro Tier',
                priceMonthly: 49,
                cardBrand: 'Mastercard',
                cardLast4: '9999',
                invoices: [
                    { date: 'Oct 1, 2025', invoiceId: '#INV-100', amount: '$49.00', status: 'PAID', url: 'https://example.com/inv-100.pdf' }
                ]
            }
        });

        const res = await request(app)
            .get('/api/settings/billing')
            .set('Cookie', [`token=${subToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.planName).toBe('Pro Tier');
        expect(res.body.priceMonthly).toBe(49);
        expect(res.body.cardBrand).toBe('Mastercard');
        expect(res.body.cardLast4).toBe('9999');
        expect(res.body.invoices.length).toBe(1);
        expect(res.body.invoices[0].invoiceId).toBe('#INV-100');
    });
});
