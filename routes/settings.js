const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../model/user');
const Url = require('../model/url');
const Invite = require('../model/invite');
const Creator = require('../model/creator');
const AnalyticsSnapshot = require('../model/analyticsSnapshot');
const EngagementHistory = require('../model/engagementHistory');
const { preventContributorWrites } = require('../middleware/auth');
const { validate, updateProfileSchema } = require('../middleware/validators');
const { isEmailTransportConfigured, sendDeletionConfirmationEmail } = require('../utils/email');
const { verifyTotp } = require('../utils/totp');

const asyncHandler = fn => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function buildBillingPayload(user) {
    const sub = user.subscription || {};
    const nextInvoice = sub.nextInvoiceDate ? new Date(sub.nextInvoiceDate) : null;

    return {
        status: sub.status || 'free',
        planName: sub.planName || 'Free',
        priceMonthly: sub.priceMonthly ?? 0,
        nextInvoiceDate: nextInvoice ? nextInvoice.toISOString() : null,
        nextInvoiceLabel: nextInvoice
            ? nextInvoice.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            })
            : 'No upcoming invoice',
        estimatedTotal: sub.priceMonthly ? `$${sub.priceMonthly.toFixed(2)} USD` : '$0.00 USD',
        cardBrand: sub.cardBrand || null,
        cardLast4: sub.cardLast4 || null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
        invoices: sub.invoices || [],
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
 *     description: Updates operations for /profile.
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
router.put('/profile', preventContributorWrites, validate(updateProfileSchema, 'body'), asyncHandler(async (req, res) => {
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
 *     description: Retrieves the authenticated user's billing information.
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
 *     description: Updates operations for /security/2fa.
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
    const { enabled, password, otp, secret } = req.body;
    const enableTwoFactor = !!enabled;

    const user = await User.findById(req.user.id).select('+twoFactorSecret +password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Local accounts must re-verify their current password before 2FA changes.
    if (user.authProvider === 'local') {
        if (!password) {
            return res.status(401).json({ error: 'Password is required to update 2FA settings' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
    }

    if (enableTwoFactor) {
        const sharedSecret = secret || user.twoFactorSecret;
        if (!sharedSecret) {
            return res.status(400).json({
                error: 'A TOTP secret is required to enable two-factor authentication',
            });
        }

        if (!otp || !verifyTotp(sharedSecret, otp)) {
            return res.status(401).json({ error: 'Invalid or missing authenticator code' });
        }

        user.twoFactorSecret = sharedSecret;
        user.twoFactorEnabled = true;
    } else {
        // Disabling an active 2FA configuration still requires a valid OTP challenge.
        if (user.twoFactorEnabled) {
            if (!user.twoFactorSecret) {
                return res.status(400).json({ error: 'Two-factor authentication is misconfigured' });
            }
            if (!otp || !verifyTotp(user.twoFactorSecret, otp)) {
                return res.status(401).json({ error: 'Invalid or missing authenticator code' });
            }
        }

        user.twoFactorEnabled = false;
    }

    await user.save();

    res.json({ message: '2FA settings updated successfully', twoFactorEnabled: user.twoFactorEnabled });
}));

// PUT /api/settings/security/password

/**
 * @swagger
 * /security/password:
 *   put:
 *     summary: PUT request for /security/password
 *     description: Updates operations for /security/password.
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

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    await user.save();

    const days = daysSince(user.passwordChangedAt);

    // Invalidate the old session by clearing the current cookie
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE_DEV === 'true',
        sameSite: 'strict',
        path: '/',
    });

    // Issue a new token so the user stays logged in after password change
    const newToken = jwt.sign(
        {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role || 'creator',
            passwordChangedAt: Math.floor(user.passwordChangedAt.getTime() / 1000),
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const isSecureEnvironment = isProduction || process.env.COOKIE_SECURE_DEV === 'true';
    res.cookie('token', newToken, {
        httpOnly: true,
        secure: isSecureEnvironment,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    });

    res.json({
        message: 'Password updated successfully',
        passwordChangedAt: user.passwordChangedAt,
        passwordAgeDays: days,
    });
}));

// POST /api/settings/account/request-deletion

/**
 * @swagger
 * /account/request-deletion:
 *   post:
 *     summary: POST request for /account/request-deletion
 *     description: Requests account deletion with password verification and sends confirmation email.
 *     responses:
 *       200:
 *         description: Deletion request scheduled
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/account/request-deletion', preventContributorWrites, asyncHandler(async (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ error: 'Password is required to request account deletion' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.scheduledDeletionAt && !user.deletionConfirmed) {
        return res.status(400).json({ error: 'Account deletion is already pending. Check your email for the confirmation link.' });
    }
    
    if (user.authProvider === 'local') {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
    } else {
        if (password !== 'google-auth') {
            return res.status(401).json({ error: 'For Google-authenticated accounts, please use "google-auth" as password' });
        }
    }
    
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 30);
    
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    
    user.scheduledDeletionAt = scheduledDate;
    user.deletionConfirmed = false;
    user.deletionConfirmationToken = confirmationToken;
    await user.save();
    
    if (isEmailTransportConfigured()) {
        try {
            const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const confirmLink = `${appUrl}/confirm-deletion?token=${confirmationToken}`;
            
            await sendDeletionConfirmationEmail({
                to: user.email,
                confirmLink,
                userName: user.name,
                scheduledDate: scheduledDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })
            });
        } catch (emailError) {
            console.error('[account-deletion] Failed to send confirmation email:', emailError);
        }
    }
    
    res.json({ 
        message: 'Account deletion requested. Please check your email to confirm the deletion.',
        scheduledDeletionAt: scheduledDate.toISOString(),
        daysUntilDeletion: 30
    });
}));

// POST /api/settings/account/confirm-deletion

/**
 * @swagger
 * /account/confirm-deletion:
 *   post:
 *     summary: POST request for /account/confirm-deletion
 *     description: Confirms account deletion via token. Requires authentication to verify the requesting user is the account owner.
 *     responses:
 *       200:
 *         description: Account deletion confirmed
 *       400:
 *         description: Invalid token or expired
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.post('/account/confirm-deletion', preventContributorWrites, asyncHandler(async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'Invalid confirmation token' });
    }
    
    // Verify the authenticated user is the account owner
    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.deletionConfirmationToken !== token) {
        return res.status(400).json({ error: 'Invalid confirmation token' });
    }
    
    if (!user.scheduledDeletionAt) {
        return res.status(400).json({ error: 'No deletion scheduled for this account' });
    }
    
    // Check token expiration (24 hours)
    const tokenAge = Date.now() - new Date(user.scheduledDeletionAt).getTime() + (30 * 24 * 60 * 60 * 1000);
    const MAX_TOKEN_AGE = 24 * 60 * 60 * 1000; // 24 hours from request time
    const deletionRequestTime = new Date(user.updatedAt).getTime();
    if (Date.now() - deletionRequestTime > MAX_TOKEN_AGE) {
        return res.status(400).json({ error: 'Confirmation token has expired. Please request deletion again.' });
    }
    
    if (user.deletionConfirmed) {
        return res.json({ message: 'Deletion already confirmed' });
    }
    
    user.deletionConfirmed = true;
    await user.save();
    
    res.json({ message: 'Account deletion confirmed' });
}));

// POST /api/settings/account/cancel-deletion

/**
 * @swagger
 * /account/cancel-deletion:
 *   post:
 *     summary: POST request for /account/cancel-deletion
 *     description: Cancels a pending account deletion request.
 *     responses:
 *       200:
 *         description: Deletion cancelled
 *       400:
 *         description: No deletion pending
 *       401:
 *         description: Unauthorized
 */
router.post('/account/cancel-deletion', preventContributorWrites, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (!user.scheduledDeletionAt) {
        return res.status(400).json({ error: 'No account deletion is pending' });
    }
    
    user.scheduledDeletionAt = null;
    user.deletionConfirmed = false;
    user.deletionConfirmationToken = null;
    await user.save();
    
    res.json({ message: 'Account deletion request cancelled successfully' });
}));

// DELETE /api/settings/account

/**
 * @swagger
 * /account:
 *   delete:
 *     summary: DELETE request for /account
 *     description: Executes pending account deletion after 30-day grace period.
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       400:
 *         description: No pending deletion or not confirmed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/account', preventContributorWrites, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (process.env.USE_MOCK_DB === 'true') {
        // Delete shortened links and collaborator invites associated with the user
        await Url.deleteMany({ userId: user._id });
        await Invite.deleteMany({ inviter: user._id });

        if (typeof user.deleteOne === 'function') {
            await user.deleteOne();
        }

        res.clearCookie('token');
        return res.json({ message: 'Account deleted successfully' });
    }

    if (!user.scheduledDeletionAt) {
        return res.status(400).json({ error: 'No account deletion is scheduled. Please request deletion first.' });
    }
    
    if (!user.deletionConfirmed) {
        return res.status(400).json({ error: 'Account deletion is not confirmed. Please confirm via the email sent to you.' });
    }
    
    if (new Date() < new Date(user.scheduledDeletionAt)) {
        const daysRemaining = Math.ceil((new Date(user.scheduledDeletionAt) - new Date()) / (1000 * 60 * 60 * 24));
        return res.status(400).json({ error: `Account deletion is scheduled for the future. ${daysRemaining} day(s) remaining.` });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        await Url.deleteMany({ userId: user._id }).session(session);
        await Invite.deleteMany({ inviter: user._id }).session(session);

        if (process.env.USE_MOCK_DB !== 'true') {
            await Creator.deleteOne({ userId: user._id }).session(session);
            await AnalyticsSnapshot.deleteMany({ creatorId: user._id }).session(session);
            await EngagementHistory.deleteMany({ creatorId: user._id }).session(session);
        }

        await User.deleteOne({ _id: user._id }).session(session);

        await session.commitTransaction();
        res.clearCookie('token');
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        await session.abortTransaction();
        console.error('[account-deletion] Transaction failed:', error);
        const isReplicaSetError = error.message && (
            error.message.includes('transaction numbers') ||
            error.message.includes('replica set') ||
            error.message.includes('Transaction isn\'t supported')
        );
        const message = isReplicaSetError
            ? 'Account deletion requires a MongoDB replica set. Please check your database configuration.'
            : 'Failed to delete account. Please try again.';
        res.status(500).json({ error: message });
    } finally {
        session.endSession();
    }
}));

// PUT /api/settings/preferences

/**
 * @swagger
 * /preferences:
 *   put:
 *     summary: PUT request for /preferences
 *     description: Updates operations for /preferences.
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
