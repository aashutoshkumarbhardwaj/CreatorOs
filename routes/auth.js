const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { signup, login, handleGoogleCallback, loginAsContributor, verifyEmail, resendVerificationEmail, requestPasswordReset, resetPassword } = require("../controller/auth");
const { signupValidator, loginValidator, resendVerificationValidator } = require("../middleware/validators");
const connectDB = require("../connect");
const { loginLimiter, signupLimiter, emailVerificationLimiter, forgotPasswordLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

const googleAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CALLBACK_URL
);

if (googleAuthConfigured) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    await connectDB();
                    const User = require("../model/user");
                    const email = profile.emails?.[0]?.value?.toLowerCase();

                    if (!email) {
                        return done(null, false, { message: "Google account does not expose an email address." });
                    }

                    const googleUser = {
                        googleId: profile.id,
                        name: profile.displayName || email.split("@")[0],
                        email,
                        avatar: profile.photos?.[0]?.value,
                        lastLoginAt: new Date(),
                    };

                    let user = await User.findOne({ googleId: profile.id });

                    if (!user) {
                        user = await User.findOne({ email });
                    }

                    if (user) {
                        user.googleId = googleUser.googleId;
                        user.name = user.name || googleUser.name;
                        user.avatar = googleUser.avatar || user.avatar;
                        user.authProvider = user.password ? user.authProvider : "google";
                        user.lastLoginAt = googleUser.lastLoginAt;
                        user.isVerified = true;
                        await user.save();
                    } else {
                        user = await User.create({
                            ...googleUser,
                            authProvider: "google",
                            isVerified: true,
                        });
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error);
                }
            }
        )
    );
}


/**
 * @swagger
 * /signup:
 *   get:
 *     summary: GET request for /signup
 *     description: Renders the user registration (signup) page.
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
router.get("/signup", (req, res) => {
    res.render("signup", { error: null });
});


/**
 * @swagger
 * /login:
 *   get:
 *     summary: GET request for /login
 *     description: Renders the user authentication (login) page.
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
router.get("/login", (req, res) => {
    const errorMessages = {
        google_cancelled: "Google sign-in was cancelled.",
        google_failed: "Google sign-in failed. Please try again.",
    };

    res.render("login", {
        error: errorMessages[req.query.error] || req.query.error || null,
        googleAuthConfigured,
        verificationUnavailable: req.query.verificationUnavailable === "1" || req.query.verificationUnavailable === "true",
        unverifiedEmail: req.query.email || null,
    });
});


/**
 * @swagger
 * /signup:
 *   post:
 *     summary: POST request for /signup
 *     description: Processes a new user registration.
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
router.post("/signup", signupLimiter, signupValidator, signup);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: POST request for /login
 *     description: Authenticates a user and establishes a session.
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
router.post("/login", loginLimiter, loginValidator, login);

/**
 * @swagger
 * /login/contributor:
 *   post:
 *     summary: POST request for /login/contributor
 *     description: Authenticates a contributor account.
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
router.post("/login/contributor", loginLimiter, loginValidator, loginAsContributor);

/**
 * @swagger
 * /api/auth/contributor-login:
 *   post:
 *     summary: POST request for /api/auth/contributor-login
 *     description: API endpoint to authenticate a contributor account.
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
router.post("/api/auth/contributor-login", loginLimiter, loginValidator, loginAsContributor);


/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: GET request for /auth/google
 *     description: Initiates the Google OAuth2 authentication flow.
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
router.get("/auth/google", (req, res, next) => {
    if (!googleAuthConfigured) {
        return res.redirect("/login?error=Google%20sign-in%20is%20not%20configured%20yet.");
    }

    return passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
        prompt: "select_account",
    })(req, res, next);
});


/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: GET request for /auth/google/callback
 *     description: Handles the callback from the Google OAuth2 flow.
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
router.get("/auth/google/callback", (req, res, next) => {
    if (req.query.error) {
        const errorCode = req.query.error === "access_denied" ? "google_cancelled" : "google_failed";
        return res.redirect(`/login?error=${errorCode}`);
    }

    return passport.authenticate("google", {
        failureRedirect: "/login?error=google_failed",
        session: false,
    })(req, res, next);
}, handleGoogleCallback);


/**
 * @swagger
 * /verify-email:
 *   get:
 *     summary: GET request for /verify-email
 *     description: Renders the email verification page.
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
router.get("/verify-email", emailVerificationLimiter, verifyEmail);


/**
 * @swagger
 * /resend-verification:
 *   get:
 *     summary: GET request for /resend-verification
 *     description: Renders the page to request a new verification email.
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
router.get("/resend-verification", (req, res) => {
    res.render("resend-verification", {
        error: null,
        success: null,
        prefilledEmail: req.query.email || null,
        verificationDeliveryUnavailable: req.query.delivery === "unavailable",
        backToLoginUrl: req.query.delivery === "unavailable"
            ? `/login?verificationUnavailable=1&email=${encodeURIComponent(req.query.email || "")}`
            : "/login",
    });
});


/**
 * @swagger
 * /resend-verification:
 *   post:
 *     summary: POST request for /resend-verification
 *     description: Generates and sends a new email verification token.
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
router.post("/resend-verification", emailVerificationLimiter, resendVerificationValidator, resendVerificationEmail);


/**
 * @swagger
 * /logout:
 *   get:
 *     summary: GET request for /logout
 *     description: Terminates the user's session and redirects to login.
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
router.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

/**
 * @swagger
 * /forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Generates and sends a password reset token to the user's email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset email sent if account exists
 *       400:
 *         description: Invalid request
 */
router.post("/forgot-password", forgotPasswordLimiter, requestPasswordReset);

/**
 * @swagger
 * /reset-password:
 *   post:
 *     summary: Reset password with token
 *     description: Validates reset token and updates user password. Token can only be used once.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid, expired, or already used token
 */
router.post("/reset-password", resetPassword);

module.exports = router;
