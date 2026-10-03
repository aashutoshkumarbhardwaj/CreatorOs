const app = require("./app");
const connectDB = require("./connect");

const port = process.env.PORT || 3000;

async function startServer() {
  try {
    // Start the HTTP server immediately
    const server = app.listen(port, () => {
      const url = process.env.APP_URL || `http://localhost:${port}`;
      console.log(`🚀 Server is running on ${url}`);
    });

    // Connect to the database
    await connectDB();
    console.log("✅ Database connected successfully.");

    // Initialize background workers after the database is ready
    require("./workers/analyticsRefreshWorker");
    require("./workers/contentPublishWorker").startContentPublishWorker();
    require("./workers/scheduledNotificationWorker").startScheduledNotificationWorker();
    require("./workers/taskReminderWorker").startTaskReminderWorker();
  } catch (error) {
    console.error("❌ Failed to start the application:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}


module.exports = app;
