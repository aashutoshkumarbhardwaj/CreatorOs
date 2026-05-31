const jwt = require("jsonwebtoken");
const connectDB = require("../connect");

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";
        const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const token = req.cookies.token || bearerToken;

        if (!token) {
        return res.redirect("/login");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await connectDB();

        if (decoded.role === "guest_contributor") {
            const ContributorSession = require("../model/contributorSession");
            const session = await ContributorSession.findOne({ contributorId: decoded.id });

            if (!session) {
                return res.redirect("/login");
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
        return res.redirect("/login");
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Admin access required" });
    }

    return next();
};

const preventContributorWrites = (req, res, next) => {
    if (req.user.role === "contributor" || req.user.role === "guest_contributor") {
        return res.status(403).json({
            success: false,
            message: "Contributor accounts do not have permission to modify data.",
        });
    }

    return next();
};

module.exports = protect;
module.exports.requireAdmin = requireAdmin;
module.exports.preventContributorWrites = preventContributorWrites;
