const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../model/user');
const { preventContributorWrites } = require('../middleware/auth');

const asyncHandler = fn => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function defaultInvoices() {
    return [
        { date: 'Sep 24, 2023', invoiceId: '#INV-88219', amount: '$29.00', status: 'PAID' },
        { date: 'Aug 24, 2023', invoiceId: '#INV-87112', amount: '$29.00', status: 'PAID' },
    ];
}

function buildBillingPayload(user) {
    const sub = user.subscription || {};
    const nextInvoice = sub.nextInvoiceDate
        ? new Date(sub.nextInvoiceDate)
        : (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            d.setDate(24);
            return d;
        })();

    return {
        planName: sub.planName || 'Pro Individual',
        priceMonthly: sub.priceMonthly ?? 29,
        nextInvoiceDate: nextInvoice.toISOString(),
        nextInvoiceLabel: nextInvoice.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }),
        estimatedTotal: `$${(sub.priceMonthly ?? 29).toFixed(2)} USD`,
        cardBrand: sub.cardBrand || 'VISA',
        cardLast4: sub.cardLast4 || '4242',
        invoices: defaultInvoices(),
    };
}

function daysSince(date) {
    if (!date) return null;
    const ms = Date.now() - new Date(date).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// PUT /api/settings/profile

/**
 * @swagger
 * /profile:
 *   put:
 *     summary: PUT request for /profile
 *     description: Automatically generated swagger documentation for /profile
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/profile', preventContributorWrites, asyncHandler(async (req, res) => {
    const { name, alias, bio } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (name !== undefined) user.name = name;
    if (alias !== undefined) user.alias = alias;
    if (bio !== undefined) user.bio = bio;
    
    await user.save();
    res.json({
        message: 'Profile updated successfully',
        user: {
            name: user.name,
            alias: user.alias,
            bio: user.bio,
        },
    });
}));


/**
 * @swagger
 * /billing:
 *   get:
 *     summary: GET request for /billing
 *     description: Automatically generated swagger documentation for /billing
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/billing', asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(buildBillingPayload(user));
}));

// PUT /api/settings/security/2fa

/**
 * @swagger
 * /security/2fa:
 *   put:
 *     summary: PUT request for /security/2fa
 *     description: Automatically generated swagger documentation for /security/2fa
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/security/2fa', preventContributorWrites, asyncHandler(async (req, res) => {
    const { enabled } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    user.twoFactorEnabled = !!enabled;
    await user.save();
    
    res.json({ message: '2FA settings updated successfully', twoFactorEnabled: user.twoFactorEnabled });
}));

// PUT /api/settings/security/password

/**
 * @swagger
 * /security/password:
 *   put:
 *     summary: PUT request for /security/password
 *     description: Automatically generated swagger documentation for /security/password
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/security/password', preventContributorWrites, asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.authProvider !== 'local') {
        return res.status(400).json({ error: 'Cannot change password for third-party authenticated accounts.' });
    }
    
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect old password' });
    }
    
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    await user.save();

    const days = daysSince(user.passwordChangedAt);
    res.json({
        message: 'Password updated successfully',
        passwordChangedAt: user.passwordChangedAt,
        passwordAgeDays: days,
    });
}));

// DELETE /api/settings/account

/**
 * @swagger
 * /account:
 *   delete:
 *     summary: DELETE request for /account
 *     description: Automatically generated swagger documentation for /account
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/account', preventContributorWrites, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (typeof user.deleteOne === 'function') {
        await user.deleteOne();
    }

    res.clearCookie('token');
    res.json({ message: 'Account deleted successfully' });
}));

// PUT /api/settings/preferences

/**
 * @swagger
 * /preferences:
 *   put:
 *     summary: PUT request for /preferences
 *     description: Automatically generated swagger documentation for /preferences
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/preferences', asyncHandler(async (req, res) => {
    // Note: Not using preventContributorWrites here so contributors can still save personal UI preferences
    const preferences = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    user.preferences = {
        ...user.preferences,
        ...preferences
    };
    
    await user.save();
    res.json({ message: 'Preferences updated successfully', preferences: user.preferences });
}));

module.exports = router;
