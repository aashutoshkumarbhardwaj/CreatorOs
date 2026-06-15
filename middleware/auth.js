const jwt = require("jsonwebtoken");
const connectDB = require("../connect");
const { wantsHtml } = require("../utils/requestType");

/**
 * @function protect
 * @description Automatically generated JSDoc for protect
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
            // For regular users, check if email is verified
            const User = require("../model/user");
            const user = await User.findOne({ email: decoded.email });

            if (!user) {
                return res.redirect("/login");
            }

            if (!user.isVerified) {
                return res.status(403).redirect("/resend-verification");
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
 * @description Automatically generated JSDoc for requireAdmin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const requireAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
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
 * @description Automatically generated JSDoc for preventContributorWrites
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const preventContributorWrites = (req, res, next) => {
    if (req.user.role === "contributor" || req.user.role === "guest_contributor") {
        return res.status(403).json({
            success: false,
            message: "Contributor accounts do not have permission to modify data.",
            error: "Contributor accounts do not have permission to modify data.",
        });
    }

    return next();
};

module.exports = protect;
module.exports.requireAdmin = requireAdmin;
module.exports.preventContributorWrites = preventContributorWrites;
