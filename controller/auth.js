const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const connectDB = require("../connect");
const asyncHandler = require("../utils/asyncHandler");
const { wantsHtml } = require("../utils/requestType");
const {
    checkIfLoginLocked,
    recordFailedLoginAttempt,
    clearLoginAttempts,
    getRemainingLoginLockoutTime,
    checkIfResetLocked,
    recordFailedResetAttempt,
    clearResetAttempts,
    getRemainingResetLockoutTime,
} = require("../utils/loginAttemptManager");

const CONTRIBUTOR_NAME = "Contributor";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const GUEST_CONTRIBUTOR_ROLE = "guest_contributor";
const GENERIC_LOGIN_ERROR = "Invalid email or password";
const GOOGLE_AUTH_CANCELLED_ERROR = "Google sign-in was cancelled or could not be completed.";

/**
 * @function getUserModel
 * @description Retrieves the User model instance.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function getUserModel() {
    await connectDB();
    return require("../model/user");
}

/**
 * @function generateVerificationToken
 * @description Generates a cryptographically secure token for email verification.
 * @returns {any}
 */
function generateVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * @function getVerificationTokenExpiry
 * @description Calculates the expiration timestamp for an email verification token.
 * @returns {any}
 */
function getVerificationTokenExpiry() {
    return new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS);
}

/**
 * @function isVerificationTokenExpired
 * @description Checks whether a given email verification token has expired.
 * @returns {any}
 */
function isVerificationTokenExpired(expiryDate) {
    return expiryDate < new Date();
}
/**
 * @function isGoogleAuthConfigured
 * @description Determines if the Google OAuth credentials have been properly configured.
 * @returns {any}
 */
function isGoogleAuthConfigured() {
    return Boolean(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL
    );
}

/**
 * @function serializeUser
 * @description Serializes a user object into a simplified format for session or token storage.
 * @returns {any}
 */
function serializeUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "creator",
    };
}

/**
 * @function createToken
 * @description Creates a JWT token for standard user authentication.
 * @returns {any}
 */
function createToken(user) {
    const tokenUser = serializeUser(user);

    return jwt.sign(
        tokenUser,
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
        }
    );
}

/**
 * @function createContributorToken
 * @description Creates a JWT token specifically for contributor access.
 * @returns {any}
 */
function createContributorToken(session) {
    return jwt.sign(
        {
            id: session.contributorId,
            sessionId: session._id.toString(),
            name: CONTRIBUTOR_NAME,
            role: GUEST_CONTRIBUTOR_ROLE,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
        }
    );
}

/**
 * @function setAuthCookie
 * @description Sets the authentication JWT token as an HTTP-only cookie with security hardening.
 * Ensures the session cookie is protected against:
 * - XSS attacks (httpOnly prevents JS access via document.cookie)
 * - Man-in-the-middle attacks (secure flag prevents transmission over HTTP)
 * - CSRF attacks (sameSite strict prevents cross-origin cookie inclusion)
 * @returns {any}
 */
function setAuthCookie(res, token) {
    // Determine if we should enforce HTTPS-only cookies
    // In production, this is mandatory. In development, allow HTTP for localhost testing.
    const isProduction = process.env.NODE_ENV === "production";
    const isSecureEnvironment = isProduction || process.env.COOKIE_SECURE_DEV === "true";

    res.cookie("token", token, {
        httpOnly: true, // Prevents JavaScript from accessing this cookie (XSS protection)
        secure: isSecureEnvironment, // Only transmit over HTTPS in production/secure environments
        sameSite: "strict", // Prevents CSRF by not including cookie in cross-origin requests
        maxAge: ONE_WEEK_MS,
        path: "/", // Explicitly set path for clarity
    });
}

/**
 * @function redirectWithLoginError
 * @description Redirects the client to the login page with a specific error message.
 * @returns {any}
 */
function redirectWithLoginError(res, error) {
    const message = error === GOOGLE_AUTH_CANCELLED_ERROR 
        ? error 
        : GENERIC_LOGIN_ERROR;
    return res.redirect(`/login?error=${encodeURIComponent(message)}`);
}

/**
 * @function renderLoginError
 * @description Renders the login view with an error message.
 * @returns {any}
 */
function renderLoginError(req, res) {
    if (wantsHtml(req)) {
        return res.status(401).render("login", {
            error: GENERIC_LOGIN_ERROR,
            googleAuthConfigured: isGoogleAuthConfigured(),
        });
    }

    return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
}

const signup = asyncHandler(async (req, res, next) => {
    const User = await getUserModel();
    const { sendVerificationEmail } = require("../utils/email");

    const { name, email, password } = req.body || {};
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
        if (wantsHtml(req)) {
            return res.status(409).render("signup", { error: "User already exists" });
        }
        return res.status(409).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = getVerificationTokenExpiry();

    const user = await User.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        authProvider: "local",
        isVerified: false,
        verificationToken,
        verificationTokenExpiry,
    });

    // Send verification email
    try {
        const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;

        await sendVerificationEmail({
            to: normalizedEmail,
            verificationLink,
            userName: name,
        });
    } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Don't fail the signup, but let user know to check email or resend
    }

    if (wantsHtml(req)) {
        return res.render("signup", { 
            error: null, 
            success: "Sign up successful! Please check your email to verify your account." 
        });
    }
    return res.status(201).json({ 
        success: true, 
        message: "Sign up successful! Please check your email to verify your account.",
        data: { id: user._id, email: user.email } 
    });
});

const login = asyncHandler(async (req, res, next) => {
    const User = await getUserModel();

    const { email, password } = req.body || {};
    const normalizedEmail = (email && typeof email === 'string') ? email.toLowerCase().trim() : "";

    if (!normalizedEmail || !password) {
        if (wantsHtml(req)) return res.redirect("/login?error=" + encodeURIComponent(GENERIC_LOGIN_ERROR));
        return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
    }

    const isLocked = await checkIfLoginLocked(normalizedEmail);
    if (isLocked) {
        const remainingTime = await getRemainingLoginLockoutTime(normalizedEmail);
        const lockoutMessage = `Account locked due to too many failed login attempts. Try again in ${Math.ceil(remainingTime / 60)} minutes.`;
        if (wantsHtml(req)) return res.status(429).render("login", { error: lockoutMessage });
        return res.status(429).json({ success: false, message: lockoutMessage });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        await recordFailedLoginAttempt(normalizedEmail);
        if (wantsHtml(req)) return res.redirect("/login?error=" + encodeURIComponent(GENERIC_LOGIN_ERROR));
        return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        await recordFailedLoginAttempt(normalizedEmail);
        if (wantsHtml(req)) return res.redirect("/login?error=" + encodeURIComponent(GENERIC_LOGIN_ERROR));
        return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
    }

    await clearLoginAttempts(normalizedEmail);

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);
    setAuthCookie(res, token);

    if (wantsHtml(req)) return res.redirect("/dashboard");
    return res.status(200).json({ success: true, token, user: serializeUser(user) });
});

/**
 * @function handleGoogleCallback
 * @description Handles the OAuth callback from Google to authenticate or register a user.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const handleGoogleCallback = asyncHandler(async (req, res, next) => {
    try {
        if (!req.user) {
            return redirectWithLoginError(res, GOOGLE_AUTH_CANCELLED_ERROR);
        }

        const token = createToken(req.user);
        setAuthCookie(res, token);

        return res.redirect("/dashboard?login=google");
    } catch (error) {
        console.error("Google login error:", error);
        return redirectWithLoginError(res, "Google sign-in failed. Please try again.");
    }
});

const loginAsContributor = asyncHandler(async (req, res, next) => {
    await connectDB();
    const ContributorSession = require("../model/contributorSession");
    const contributorId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ONE_WEEK_MS);
    const session = await ContributorSession.create({
        contributorId,
        role: GUEST_CONTRIBUTOR_ROLE,
        expiresAt,
    });
    const user = {
        id: contributorId,
        name: CONTRIBUTOR_NAME,
        role: GUEST_CONTRIBUTOR_ROLE,
    };
    const token = createContributorToken(session);
    setAuthCookie(res, token);

    if (wantsHtml(req)) return res.redirect("/dashboard");
    return res.status(200).json({
        success: true,
        token,
        user,
    });
});

const verifyEmail = asyncHandler(async (req, res, next) => {
    const User = await getUserModel();
    const { token } = req.query;

    if (!token) {
        if (wantsHtml(req)) {
            return res.status(400).render("verify-email", { 
                error: "Invalid verification link. Please request a new one.",
                success: null,
                expiredToken: false,
                userEmail: null
            });
        }
        return res.status(400).json({ 
            success: false, 
            message: "Invalid verification link." 
        });
    }

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
        if (wantsHtml(req)) {
            return res.status(400).render("verify-email", { 
                error: "Invalid verification link. Please request a new one.",
                success: null,
                expiredToken: false,
                userEmail: null
            });
        }
        return res.status(400).json({ 
            success: false, 
            message: "Invalid verification link." 
        });
    }

    if (user.isVerified) {
        if (wantsHtml(req)) {
            return res.render("verify-email", { 
                success: "Your email is already verified. You can log in now.",
                error: null,
                expiredToken: false,
                userEmail: null
            });
        }
        return res.status(200).json({ 
            success: true, 
            message: "Your email is already verified." 
        });
    }

    if (isVerificationTokenExpired(user.verificationTokenExpiry)) {
        if (wantsHtml(req)) {
            return res.status(410).render("verify-email", { 
                error: "Verification link has expired. Please request a new one.",
                success: null,
                expiredToken: true,
                userEmail: user.email
            });
        }
        return res.status(410).json({ 
            success: false, 
            message: "Verification link has expired.",
            userEmail: user.email,
        });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await user.save();

    if (wantsHtml(req)) {
        return res.render("verify-email", { 
            success: "Your email has been verified successfully! You can now log in.",
            error: null,
            expiredToken: false,
            userEmail: null
        });
    }
    return res.status(200).json({ 
        success: true, 
        message: "Email verified successfully!" 
    });
});

const resendVerificationEmail = asyncHandler(async (req, res, next) => {
    const User = await getUserModel();
    const { sendVerificationEmail } = require("../utils/email");
    const { email } = req.body || {};

    if (!email) {
        if (wantsHtml(req)) {
            return res.status(400).render("resend-verification", { 
                error: "Email address is required.",
                success: null
            });
        }
        return res.status(400).json({ 
            success: false, 
            message: "Email address is required." 
        });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        // Don't reveal whether email exists
        if (wantsHtml(req)) {
            return res.render("resend-verification", { 
                success: "If that email address is in our system, you'll receive a verification email shortly.",
                error: null
            });
        }
        return res.status(200).json({ 
            success: true, 
            message: "If that email address is in our system, you'll receive a verification email shortly." 
        });
    }

    if (user.isVerified) {
        if (wantsHtml(req)) {
            return res.render("resend-verification", { 
                success: "Your email is already verified. You can log in now.",
                error: null
            });
        }
        return res.status(200).json({ 
            success: true, 
            message: "Your email is already verified." 
        });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = getVerificationTokenExpiry();

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    // Send verification email
    try {
        const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;

        await sendVerificationEmail({
            to: normalizedEmail,
            verificationLink,
            userName: user.name,
        });
    } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        if (wantsHtml(req)) {
            return res.status(500).render("resend-verification", { 
                error: "Failed to send verification email. Please try again later.",
                success: null
            });
        }
        return res.status(500).json({ 
            success: false, 
            message: "Failed to send verification email. Please try again later." 
        });
    }

    if (wantsHtml(req)) {
        return res.render("resend-verification", { 
            success: "Verification email sent! Please check your inbox.",
            error: null
        });
    }
    return res.status(200).json({ 
        success: true, 
        message: "Verification email sent successfully!" 
    });
});

/**
 * @function requestPasswordReset
 * @description Generates a secure password reset token and sends it via email.
 * Token expires after 15 minutes and can only be used once.
 */
const requestPasswordReset = asyncHandler(async (req, res) => {
    const User = await getUserModel();
    const PasswordResetToken = require('../model/passwordResetToken');
    const { email } = req.body || {};

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const isLocked = await checkIfResetLocked(normalizedEmail);
    if (isLocked) {
        const remainingTime = await getRemainingResetLockoutTime(normalizedEmail);
        const lockoutMessage = `Too many password reset attempts. Try again in ${Math.ceil(remainingTime / 60)} minutes.`;
        return res.status(429).json({ success: false, message: lockoutMessage });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        await recordFailedResetAttempt(normalizedEmail);
        return res.json({ success: true, message: 'If email exists, reset link has been sent' });
    }

    // Create password reset token (15 minute validity)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await PasswordResetToken.create({
        userId: user._id,
        token: resetToken,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
    });

    // Send reset link via email
    try {
        const { sendPasswordResetEmail } = require('../utils/email');
        const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

        await sendPasswordResetEmail({
            to: user.email,
            resetLink,
            userName: user.name,
        });
    } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        return res.json({ success: true, message: 'If email exists, reset link has been sent. If you do not receive an email, please contact support or try again later.' });
    }

    return res.json({ success: true, message: 'If email exists, reset link has been sent. Please check your email inbox (and spam folder).' });
});

/**
 * @function resetPassword
 * @description Validates password reset token and updates user password.
 * Marks token as used to prevent replay attacks.
 */
const resetPassword = asyncHandler(async (req, res) => {
    const User = await getUserModel();
    const PasswordResetToken = require('../model/passwordResetToken');
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token and password are required' });
    }

    // Find reset token
    const resetTokenDoc = await PasswordResetToken.findOne({ token });
    if (!resetTokenDoc) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    // Check if token is already used
    if (resetTokenDoc.used) {
        return res.status(400).json({ success: false, message: 'This reset token has already been used' });
    }

    // Check if token has expired
    if (resetTokenDoc.expiresAt < new Date()) {
        return res.status(400).json({ success: false, message: 'Reset token has expired' });
    }

    // Update user password
    const user = await User.findById(resetTokenDoc.userId);
    if (!user) {
        return res.status(400).json({ success: false, message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // Mark token as used (single-use enforcement)
    resetTokenDoc.used = true;
    resetTokenDoc.usedAt = new Date();
    await resetTokenDoc.save();

    await clearResetAttempts(user.email);

    return res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
});

module.exports = {
    signup,
    login,
    handleGoogleCallback,
    loginAsContributor,
    verifyEmail,
    resendVerificationEmail,
    requestPasswordReset,
    resetPassword,
};
