const connectDB = require("../connect");

/**
 * Vercel Serverless specific middleware to ensure the database
 * is connected on every incoming request.
 */
const vercelDbConnection = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = vercelDbConnection;
