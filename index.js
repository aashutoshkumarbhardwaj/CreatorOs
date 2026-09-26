const dotenv = require("dotenv");
dotenv.config();
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local", override: true });
}
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("JWT_SECRET must be set in production.");
    process.exit(1);
  }
  process.env.JWT_SECRET = require("crypto").randomBytes(32).toString("hex");
}

const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const passport = require("passport");
const path = require("path");
const crypto = require("crypto");

const cacheHeadersMiddleware = require("./middleware/cacheHeaders");
const vercelDbConnection = require("./middleware/vercelDbConnection");
const vercelSanitization = require("./middleware/vercelSanitization");
const errorHandler = require("./middleware/errorHandler");

const { BRAND } = require("./utils/brand");
const connectDB = require("./connect");
const masterRouter = require("./routes");
const healthRoutes = require("./routes/health");

const { handleWebhook: handleBillingWebhook } = require("./controller/billing");
const {
  verifyWebhook,
  verifyWebhookSignature,
  handleWebhook: handleInstagramWebhook,
} = require("./controller/instagramWebhookController");
const { generateCsrf, verifyCsrf } = require("./middleware/csrf");

// Validate required environment variables
const requiredEnvVars = [
  { name: "MONGODB_URI", description: "MongoDB connection string" },
  { name: "JWT_SECRET", description: "Secret key for JWT token signing" },
  {
    name: "INSTAGRAM_WEBHOOK_VERIFY_TOKEN",
    description: "Instagram webhook verification token",
  },
  {
    name: "INSTAGRAM_APP_SECRET",
    description: "Instagram app secret for webhook signature verification",
  },
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v.name]);

if (missingVars.length > 0) {
  console.warn("\n⚠️ Missing environment variables for full production mode:");
  missingVars.forEach((v) => {
    console.warn(`   - ${v.name} (${v.description})`);
  });
  console.warn("\n📋 The app will start in local mock mode.");
  console.warn(
    "   To use a real database, copy .env.example to .env.local and fill in the values.\n"
  );
}

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "view"));
app.locals.BRAND = BRAND;

app.use(vercelDbConnection);

// Generate a per-request nonce before Helmet so early exits (CSRF/validation)
// still receive CSP headers that reference res.locals.nonce.
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          (req, res) => `'nonce-${res.locals.nonce}'`,
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(cacheHeadersMiddleware);
app.use(cookieParser());

app.post('/api/billing/webhook', express.raw({ type: "application/json" }), handleBillingWebhook);

app.use(express.urlencoded({ extended: true }));
app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(vercelSanitization);

// Observability endpoints (/health, /metrics) must be mounted before CSRF middleware
app.use("/", healthRoutes);

// Instagram webhook must be mounted before the global CSRF middleware so Meta
// callbacks (which carry no _csrf cookie) are verified by HMAC signature only.
app.get("/api/instagram/webhook", verifyWebhook);
app.post(
  "/api/instagram/webhook",
  verifyWebhookSignature,
  handleInstagramWebhook
);

app.use(generateCsrf);
app.use(verifyCsrf);
app.use(passport.initialize());

app.use(express.static(path.join(__dirname, "public")));

// Mount Master Router
app.use("/", masterRouter);

// ── 404 HANDLER ──
app.use((req, res) => {
  res.status(404).render("404", {
    url: req.originalUrl,
  });
});

// ── ERROR HANDLER — must be last ──
app.use(errorHandler);

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
