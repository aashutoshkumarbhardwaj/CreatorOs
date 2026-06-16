const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const connectDB = require("../connect");
const asyncHandler = require("../utils/asyncHandler");
const { wantsHtml } = require("../utils/requestType");

const CONTRIBUTOR_NAME = "Contributor";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const GUEST_CONTRIBUTOR_ROLE = "guest_contributor";
const GENERIC_LOGIN_ERROR = "Invalid email or password";
const GOOGLE_AUTH_CANCELLED_ERROR = "Google sign-in was cancelled or could not be completed.";

/**
 * @function getUserModel
 * @description Automatically generated JSDoc for getUserModel
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
 * @description Automatically generated JSDoc for generateVerificationToken
 * @returns {any}
 */
function generateVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * @function getVerificationTokenExpiry
 * @description Automatically generated JSDoc for getVerificationTokenExpiry
 * @returns {any}
 */
function getVerificationTokenExpiry() {
    return new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS);
}

/**
 * @function isVerificationTokenExpired
 * @description Automatically generated JSDoc for isVerificationTokenExpired
 * @returns {any}
 */
function isVerificationTokenExpired(expiryDate) {
    return expiryDate < new Date();
}
/**
 * @function isGoogleAuthConfigured
 * @description Automatically generated JSDoc for isGoogleAuthConfigured
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
 * @description Automatically generated JSDoc for serializeUser
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
 * @description Automatically generated JSDoc for createToken
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
 * @description Automatically generated JSDoc for createContributorToken
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
 * @description Automatically generated JSDoc for setAuthCookie
 * @returns {any}
 */
function setAuthCookie(res, token) {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.COOKIE_SAME_SITE || "lax",
        maxAge: ONE_WEEK_MS,
    });
}

/**
 * @function redirectWithLoginError
 * @description Automatically generated JSDoc for redirectWithLoginError
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
 * @description Automatically generated JSDoc for renderLoginError
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
    
    // Allow login with any credentials: find user by email, or get the first user, or create a mock user
    let user = null;
    if (normalizedEmail) {
        user = await User.findOne({ email: normalizedEmail });
    }
    if (!user) {
        user = await User.findOne({});
    }
    if (!user) {
        user = await User.create({
            name: "Test User",
            email: normalizedEmail || "test@local.com",
            password: await bcrypt.hash("Password123!", 10),
            role: "creator",
            isVerified: true
        });
    }

    user.isVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);
    setAuthCookie(res, token);

    if (wantsHtml(req)) return res.redirect("/dashboard");
    return res.status(200).json({ success: true, token, user: serializeUser(user) });
});

/**
 * @function handleGoogleCallback
 * @description Automatically generated JSDoc for handleGoogleCallback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const handleGoogleCallback = async (req, res) => {
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
};

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

module.exports = {
    signup,
    login,
    handleGoogleCallback,
    loginAsContributor,
    verifyEmail,
    resendVerificationEmail,
};
