const mongoose = require("mongoose");

let connectionPromise = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return;
    if (connectionPromise) return connectionPromise;

    const uri = process.env.MONGODB_URI;

    if (!uri || uri.includes("<user_name>") || uri.includes("<password>") || uri.includes("7udof89w.mongodb.net")) {
        console.error("\n❌ FATAL ERROR: MongoDB URI is missing or invalid.");
        console.error("❌ Do not deploy without a valid MONGODB_URI environment variable.");
        process.exit(1);
    }

    try {
        connectionPromise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000
        });
        await connectionPromise;

        console.log("MongoDB Connected Successfully");
    } catch (error) {
        connectionPromise = null;
        console.error("\n❌ FATAL ERROR: MongoDB Connection Failed.");
        console.error("Error specifics:", error.message);
        console.error("👉 Ensure your MONGODB_URI is correct and the deployment server's IP is whitelisted in your MongoDB cluster (e.g., MongoDB Atlas Network Access).");
        process.exit(1);
    }
};

module.exports = connectDB;
