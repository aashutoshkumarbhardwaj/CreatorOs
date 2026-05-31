const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { signup, login, handleGoogleCallback, loginAsContributor, verifyEmail, resendVerificationEmail } = require("../controller/auth");
const { signupValidator, loginValidator } = require("../middleware/validateAuth");
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

router.get("/signup", (req, res) => {
    res.render("signup", { error: null });
});

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

router.post("/signup", signupValidator, signup);
router.post("/login", loginValidator, login);
router.post("/login/contributor", loginAsContributor);
router.post("/api/auth/contributor-login", loginAsContributor);

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

router.get("/verify-email", (req, res) => {
    res.render("verify-email", { error: null, success: null, expiredToken: false });
});

router.post("/verify-email", verifyEmail);

router.get("/resend-verification", (req, res) => {
    res.render("resend-verification", { error: null, success: null });
});

router.post("/resend-verification", resendVerificationEmail);

router.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

module.exports = router;
