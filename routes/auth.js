const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { signup, login, handleGoogleCallback, loginAsContributor, verifyEmail, resendVerificationEmail } = require("../controller/auth");
const { signupValidator, loginValidator } = require("../middleware/validators");
const connectDB = require("../connect");

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
                        await user.save();
                    } else {
                        user = await User.create({
                            ...googleUser,
                            authProvider: "google",
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
 *     description: Automatically generated swagger documentation for /signup
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
 *     description: Automatically generated swagger documentation for /login
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
    });
});


/**
 * @swagger
 * /signup:
 *   post:
 *     summary: POST request for /signup
 *     description: Automatically generated swagger documentation for /signup
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
router.post("/signup", signupValidator, signup);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: POST request for /login
 *     description: Automatically generated swagger documentation for /login
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
router.post("/login", loginValidator, login);

/**
 * @swagger
 * /login/contributor:
 *   post:
 *     summary: POST request for /login/contributor
 *     description: Automatically generated swagger documentation for /login/contributor
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
router.post("/login/contributor", loginAsContributor);

/**
 * @swagger
 * /api/auth/contributor-login:
 *   post:
 *     summary: POST request for /api/auth/contributor-login
 *     description: Automatically generated swagger documentation for /api/auth/contributor-login
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
router.post("/api/auth/contributor-login", loginAsContributor);


/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: GET request for /auth/google
 *     description: Automatically generated swagger documentation for /auth/google
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
 *     description: Automatically generated swagger documentation for /auth/google/callback
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
 *     description: Automatically generated swagger documentation for /verify-email
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
router.get("/verify-email", (req, res) => {
    res.render("verify-email", { error: null, success: null, expiredToken: false });
});


/**
 * @swagger
 * /verify-email:
 *   post:
 *     summary: POST request for /verify-email
 *     description: Automatically generated swagger documentation for /verify-email
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
router.post("/verify-email", verifyEmail);


/**
 * @swagger
 * /resend-verification:
 *   get:
 *     summary: GET request for /resend-verification
 *     description: Automatically generated swagger documentation for /resend-verification
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
    res.render("resend-verification", { error: null, success: null });
});


/**
 * @swagger
 * /resend-verification:
 *   post:
 *     summary: POST request for /resend-verification
 *     description: Automatically generated swagger documentation for /resend-verification
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
router.post("/resend-verification", resendVerificationEmail);


/**
 * @swagger
 * /logout:
 *   get:
 *     summary: GET request for /logout
 *     description: Automatically generated swagger documentation for /logout
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

module.exports = router;
