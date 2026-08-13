const jwt = require("jsonwebtoken");
const connectDB = require("../connect");
const { wantsHtml } = require("../utils/requestType");
const { isEmailTransportConfigured } = require("../utils/email");

/**
 * @function protect
 * @description Middleware to ensure the request is authenticated via a valid JWT token.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";
        const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const token = req.cookies.token || bearerToken;

        if (!token) {
            if (process.env.USE_MOCK_DB === "true" || !process.env.JWT_SECRET) {
                req.user = { id: "60d5ecb8b5c9c62b3c7b3999", name: "Mock Creator", email: "mock@creator.os" };
                return next();
            }
            if (wantsHtml(req)) return res.redirect("/login");
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                error: "Authentication required",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await connectDB();

        if (decoded.role === "guest_contributor") {
            const ContributorSession = require("../model/contributorSession");
            const session = await ContributorSession.findOne({ contributorId: decoded.id });

            if (!session) {
                if (wantsHtml(req)) return res.redirect("/login");
                return res.status(401).json({
                    success: false,
                    message: "Invalid session",
                    error: "Invalid session",
                });
            }
        } else {
            const User = require("../model/user");
            const user = await User.findOne({ email: decoded.email });

            if (!user) {
                if (wantsHtml(req)) return res.redirect("/login");
                return res.status(401).json({
                    success: false,
                    message: "User not found",
                    error: "User not found",
                });
            }

            // Check if password was changed after token was issued
            if (user.passwordChangedAt && decoded.iat) {
                const passwordChangedAt = Math.floor(
                    new Date(user.passwordChangedAt).getTime() / 1000
                );
                if (passwordChangedAt > decoded.iat) {
                    if (wantsHtml(req)) return res.redirect("/login");
                    return res.status(401).json({
                        success: false,
                        message: "Password recently changed. Please log in again.",
                        error: "Password recently changed. Please log in again.",
                    });
                }
            }

            const isProduction = process.env.NODE_ENV === "production";
            const isTest = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined || process.env.USE_MOCK_DB === "true";
            if ((isProduction || isTest) && !user.isVerified && user.authProvider !== 'google' && (isEmailTransportConfigured() || isTest)) {
                const query = new URLSearchParams({
                    email: decoded.email,
                    delivery: isEmailTransportConfigured() ? 'configured' : 'unavailable',
                });

                return res.status(403).redirect(`/resend-verification?${query.toString()}`);
            }
        }

        req.user = decoded;

        next();
    } catch (error) {
        if (wantsHtml(req)) return res.redirect("/login");
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
            error: "Invalid or expired token",
        });
    }
};

/**
 * @function requireAdmin
 * @description Middleware to ensure the authenticated user has administrative privileges.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
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
 * @function preventContributorWrites
 * @description Middleware to restrict contributor accounts from performing write operations.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const preventContributorWrites = (req, res, next) => {
    if (!req.user || req.user.role === "contributor" || req.user.role === "guest_contributor") {
        return res.status(403).json({
            success: false,
            message: "Contributor accounts do not have permission to modify data.",
            error: "Contributor accounts do not have permission to modify data.",
        });
    }

    return next();
};

/**
 * @function redirectIfAuthenticated
 * @description Middleware for landing page to redirect already-authenticated users to /dashboard.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const redirectIfAuthenticated = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";
        const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const token = req.cookies.token || bearerToken;

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await connectDB();

        if (decoded.role === "guest_contributor") {
            const ContributorSession = require("../model/contributorSession");
            const session = await ContributorSession.findOne({ contributorId: decoded.id });

            if (!session) {
                return next();
            }
        } else {
            const User = require("../model/user");
            const user = await User.findOne({ email: decoded.email });

            if (!user) {
                return next();
            }

            if (user.passwordChangedAt && decoded.iat) {
                const passwordChangedAt = Math.floor(
                    new Date(user.passwordChangedAt).getTime() / 1000
                );
                if (passwordChangedAt > decoded.iat) {
                    return next();
                }
            }

            const isProduction = process.env.NODE_ENV === "production";
            if (isProduction && !user.isVerified && user.authProvider !== 'google' && isEmailTransportConfigured()) {
                return next();
            }
        }

        return res.redirect("/dashboard");
    } catch (error) {
        return next();
    }
};


module.exports = {
    protect,
    requireAdmin,
    preventContributorWrites,
    redirectIfAuthenticated,
};
