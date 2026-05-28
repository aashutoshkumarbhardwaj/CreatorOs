const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const connectDB = require("../connect");
const asyncHandler = require("../utils/asyncHandler");

const CONTRIBUTOR_NAME = "Contributor";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const GUEST_CONTRIBUTOR_ROLE = "guest_contributor";
const GENERIC_LOGIN_ERROR = "Invalid email or password";

async function getUserModel() {
    await connectDB();
    return require("../model/user");
}

function wantsHtml(req) {
    const accept = req.headers.accept || "";
    return accept.includes("text/html");
}

function isGoogleAuthConfigured() {
    return Boolean(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL
    );
}

function serializeUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "creator",
    };
}

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

function setAuthCookie(res, token) {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ONE_WEEK_MS,
    });
}

function redirectWithLoginError(res, error) {
    return res.redirect(`/login?error=${encodeURIComponent(error)}`);
}

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

    const user = await User.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        authProvider: "local",
    });

    if (wantsHtml(req)) return res.redirect("/login");
    return res.status(201).json({ success: true, data: { id: user._id, email: user.email } });
});

const login = asyncHandler(async (req, res, next) => {
    const User = await getUserModel();

    const { email, password } = req.body || {};
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.password) {
        return renderLoginError(req, res);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return renderLoginError(req, res);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);
    setAuthCookie(res, token);

    if (wantsHtml(req)) return res.redirect("/dashboard");
    return res.status(200).json({ success: true, token, user: serializeUser(user) });
});

const handleGoogleCallback = async (req, res) => {
    try {
        if (!req.user) {
            return redirectWithLoginError(res, "Google sign-in was cancelled or could not be completed.");
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

module.exports = {
    signup,
    login,
    handleGoogleCallback,
    loginAsContributor,
};
