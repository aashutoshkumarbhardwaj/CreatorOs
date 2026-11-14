
const jwt = require("jsonwebtoken");
const connectDB = require("../connect");
const { wantsHtml } = require("../utils/requestType");
const { isEmailTransportConfigured } = require("../utils/email");

const MOCK_USER = {
    id: "60d5ecb8b5c9c62b3c7b3999",
    name: "Mock Creator",
    email: "mock@creator.os",
    role: "admin",
};

const isProduction = () => process.env.NODE_ENV === "production";

const getToken = (req) => {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.match(/^Bearer\s+(.+)$/i);

    return req.cookies?.token || bearerToken?.[1]?.trim() || null;
};

const sendAuthError = (req, res, message, status = 401) => {
    if (wantsHtml(req) && status === 401) {
        return res.redirect("/login");
    }

    return res.status(status).json({
        success: false,
        message,
        error: message,
    });
};

const verifyToken = (token) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
    });

    if (
        !decoded ||
        typeof decoded !== "object" ||
        typeof decoded.id !== "string" ||
        !decoded.role
    ) {
        throw new jwt.JsonWebTokenError("Invalid token payload");
    }

    return decoded;
};

const isPasswordChanged = (user, decoded) => {
    if (!user.passwordChangedAt || !decoded.iat) {
        return false;
    }

    const changedAt = Math.floor(
        new Date(user.passwordChangedAt).getTime() / 1000
    );

    return changedAt > decoded.iat;
};

const checkVerification = (req, res, user, email) => {
    if (
        isProduction() &&
        !user.isVerified &&
        user.authProvider !== "google"
    ) {
        const query = new URLSearchParams({
            email,
            delivery: isEmailTransportConfigured()
                ? "configured"
                : "unavailable",
        });

        return res.redirect(
            `/resend-verification?${query.toString()}`
        );
    }

    return null;
};

/**
 * Authentication middleware
 */
const protect = async (req, res, next) => {
    try {
        const token = getToken(req);

        // Mock authentication is restricted to non-production environments.
        if (!token) {
            if (
                process.env.USE_MOCK_DB === "true" &&
                !isProduction()
            ) {
                req.user = { ...MOCK_USER };
                return next();
            }

            return sendAuthError(
                req,
                res,
                "Authentication required"
            );
        }

        let decoded;

        try {
            decoded = verifyToken(token);
        } catch (error) {
            if (error.message === "JWT_SECRET is not configured") {
                return next(error);
            }

            return sendAuthError(
                req,
                res,
                "Invalid or expired token"
            );
        }

        await connectDB();

        // Guest contributor authentication
        if (decoded.role === "guest_contributor") {
            const ContributorSession = require("../model/contributorSession");

            const session = await ContributorSession.findOne({
                contributorId: decoded.id,
            });

            if (!session) {
                return sendAuthError(
                    req,
                    res,
                    "Invalid session"
                );
            }

            req.user = {
                ...decoded,
                role: "guest_contributor",
            };

            return next();
        }

        // Regular user authentication
        const User = require("../model/user");

        const user = await User.findOne({
            email: decoded.email,
        });

        if (!user) {
            return sendAuthError(
                req,
                res,
                "User not found"
            );
        }

        if (user.isActive === false) {
            return sendAuthError(
                req,
                res,
                "Account is disabled",
                403
            );
        }

        // Invalidate tokens issued before password changes.
        if (isPasswordChanged(user, decoded)) {
            return sendAuthError(
                req,
                res,
                "Password recently changed. Please log in again."
            );
        }

        // Require email verification in production.
        const verificationResponse = checkVerification(
            req,
            res,
            user,
            decoded.email
        );

        if (verificationResponse) {
            return res.status(403).json
                ? verificationResponse.status(403).redirect(
                    verificationResponse.location
                )
                : verificationResponse;
        }

        // Use current database role instead of potentially stale JWT role.
        req.user = {
            ...decoded,
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
        };

        return next();

    } catch (error) {
        return next(error);
    }
};

/**
 * Admin authorization middleware
 */
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required",
            error: "Admin access required",
        });
    }

    return next();
};

/**
 * Prevent contributors from modifying data
 */
const preventContributorWrites = (req, res, next) => {
    if (
        !req.user ||
        ["contributor", "guest_contributor"].includes(req.user.role)
    ) {
        return res.status(403).json({
            success: false,
            message: "Contributor accounts do not have permission to modify data.",
            error: "Contributor accounts do not have permission to modify data.",
        });
    }

    return next();
};

/**
 * Redirect authenticated users to dashboard
 */
const redirectIfAuthenticated = async (req, res, next) => {
    try {
        const token = getToken(req);

        if (!token) {
            return next();
        }

        let decoded;

        try {
            decoded = verifyToken(token);
        } catch (error) {
            if (error.message === "JWT_SECRET is not configured") {
                return next(error);
            }

            return next();
        }

        await connectDB();

        if (decoded.role === "guest_contributor") {
            const ContributorSession = require("../model/contributorSession");

            const session = await ContributorSession.findOne({
                contributorId: decoded.id,
            });

            if (!session) {
                return next();
            }

            return res.redirect("/dashboard");
        }

        const User = require("../model/user");

        const user = await User.findOne({
            email: decoded.email,
        });

        if (
            !user ||
            user.isActive === false ||
            isPasswordChanged(user, decoded)
        ) {
            return next();
        }

        if (
            isProduction() &&
            !user.isVerified &&
            user.authProvider !== "google"
        ) {
            return next();
        }

        return res.redirect("/dashboard");

    } catch (error) {
        return next(error);
    }
};

module.exports = {
    protect,
    requireAdmin,
    preventContributorWrites,
    redirectIfAuthenticated,
};
