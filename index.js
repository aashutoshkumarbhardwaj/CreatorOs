const dotenv = require("dotenv");
dotenv.config();
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local", override: true });
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "dev_secret_key_creatoros_2026";
}
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const passport = require("passport");
const path = require("path");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { generalLimiter } = require("./middleware/rateLimiters");
const cacheHeadersMiddleware = require("./middleware/cacheHeaders");
const {
  getProfileFromCache,
  setProfileInCache,
  invalidateProfileCache,
} = require("./utils/profileCache");

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
    "   To use a real database, copy .env.example to .env.local and fill in the values.\n",
  );
}

const app = express();
const { BRAND } = require("./utils/brand");
const connectDB = require("./connect");

// Vercel Serverless specific: ensure DB connects on every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// --- Route Imports ---
const urlRoutes = require("./routes/url");
const analyticsRoutes = require("./routes/analytics");
const collaborationRoutes = require("./routes/collaboration");
const aiRoute = require("./routes/ai");
const authRoutes = require("./routes/auth");
const instagramRoutes = require("./routes/instagram");
const billingRoute = require("./routes/billing");
const { handleWebhook: handleBillingWebhook } = require("./controller/billing");
const {
  verifyWebhook,
  verifyWebhookSignature,
  handleWebhook: handleInstagramWebhook,
} = require("./controller/instagramWebhookController");
const domainRoute = require("./routes/domain");
const sponsorRoute = require("./routes/sponsor");
const settingsRoutes = require("./routes/settings");
const contentRoutes = require("./routes/content");
const suggestionRoutes = require("./routes/suggestionRoutes");
const qrCodeRoutes = require("./routes/qrCode");
const smartNotificationRoutes = require("./routes/smartNotificationRoutes");
const contentOsRoutes = require("./routes/contentOsRoutes");
const creatorCrmRoutes = require("./routes/creatorCrmRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const { generateCsrf, verifyCsrf } = require("./middleware/csrf");

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
  }),
);
app.use(cors());
app.use(cacheHeadersMiddleware);
app.use(cookieParser());
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  handleBillingWebhook,
);
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
// Fix for Vercel Serverless: req.query is a getter, so direct assignment throws TypeError.
app.use((req, res, next) => {
  ["body", "params", "headers", "query"].forEach((key) => {
    if (req[key]) {
      const sanitized = mongoSanitize.sanitize(req[key], { replaceWith: "_" });
      try {
        req[key] = sanitized;
      } catch (e) {
        // If assignment fails (e.g., getter-only on Vercel), use Object.defineProperty
        Object.defineProperty(req, key, {
          value: sanitized,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
  });
  next();
});
// Instagram webhook must be mounted before the global CSRF middleware so Meta
// callbacks (which carry no _csrf cookie) are verified by HMAC signature only.
app.get("/api/instagram/webhook", verifyWebhook);
app.post(
  "/api/instagram/webhook",
  verifyWebhookSignature,
  handleInstagramWebhook,
);
app.use(generateCsrf);
app.use(verifyCsrf);
app.use(passport.initialize());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "view"));
app.locals.BRAND = BRAND;

const urlShortenerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Too many URLs generated, please try again later.",
});

app.use("/", authRoutes);

const {
  protect,
  preventContributorWrites,
  redirectIfAuthenticated,
} = require("./middleware/auth");

app.use(express.static(path.join(__dirname, "public")));
const shortid = require("shortid");
const services = require("./services.config");
const User = require("./model/user");
const Creator = require("./model/creator");
const Invite = require("./model/invite");
const BioProfile = require("./model/bioProfile");
const Url = require("./model/url");
const UploadFile = require("./model/upload");
const port = process.env.PORT || 3000;
const asyncHandler = require("./utils/asyncHandler");

const {
  acceptInvite,
  acceptInviteFromDashboard,
} = require("./controller/collaborationController");
const { getDashboardData } = require("./utils/dashboardHelper");
const { renderCalendarPage } = require("./controller/contentOsController");

app.use("/suggestions", protect, suggestionRoutes);
app.use("/services/creator-crm", protect, collaborationRoutes);
app.use("/services/qr-code-generator", qrCodeRoutes);
app.use("/services/content-os", protect, contentOsRoutes);
app.get("/services/content-calendar", protect, renderCalendarPage);
app.use("/", smartNotificationRoutes);
app.use("/", meetingRoutes);
app.post(
  "/dashboard/accept-invite",
  protect,
  preventContributorWrites,
  acceptInviteFromDashboard,
);
app.get("/invites/accept/:token", acceptInvite);

// Billing & Domain Routes

// API Routes
app.use("/api", generalLimiter);
app.use("/api/billing", billingRoute);
app.use("/api/domain", domainRoute);
app.use("/api/sponsors", sponsorRoute);
app.use("/api/crm", creatorCrmRoutes);
app.use("/api/settings", protect, settingsRoutes);
app.use("/api/content", protect, contentRoutes);
app.use("/api/urls", protect, urlRoutes);
app.use("/api/ai", aiRoute);
app.use("/api/analytics", protect, analyticsRoutes);
app.use("/api/instagram", instagramRoutes);

// API Documentation
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./utils/swaggerOptions");

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCssUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.min.css",
  }),
);

// ── HELPERS ──────────────────────────────────────────────────────────────────

function findServiceByKey(key) {
  return services.find((service) => service.key === key);
}

function buildShortenerViewModel(req, shortId = null, error = null) {
  return {
    service: findServiceByKey("url-shortener"),
    services,
    shortUrl: shortId
      ? `${req.protocol}://${req.get("host")}/u/${shortId}`
      : null,
    error,
    user: buildAccountViewModel(null, req.user),
  };
}

function buildAccountViewModel(userDoc, fallbackUser) {
  const name = userDoc?.name || fallbackUser?.name || "Creator";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "CR";

  const passwordChangedAt =
    userDoc?.passwordChangedAt || userDoc?.updatedAt || null;
  let passwordAgeDays = null;
  if (passwordChangedAt) {
    passwordAgeDays = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(passwordChangedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
  }

  const sub = userDoc?.subscription || {};
  const nextInvoice = sub.nextInvoiceDate
    ? new Date(sub.nextInvoiceDate)
    : null;

  return {
    id: fallbackUser.id,
    name,
    email: userDoc?.email || fallbackUser?.email || "",
    alias: userDoc?.alias || "",
    bio: userDoc?.bio || "",
    twoFactorEnabled: userDoc?.twoFactorEnabled || false,
    preferences: userDoc?.preferences || {
      appearanceMode: "light",
      interfaceDensity: "tactile",
      motionEffects: true,
      soundCues: false,
      autoSaveLinks: true,
    },
    passwordAgeDays,
    billing: {
      status: sub.status || "free",
      planName: sub.planName || "Free",
      priceMonthly: sub.priceMonthly ?? 0,
      nextInvoiceLabel: nextInvoice
        ? nextInvoice.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "No upcoming invoice",
      estimatedTotal: sub.priceMonthly
        ? `$${sub.priceMonthly.toFixed(2)} USD`
        : "$0.00 USD",
      cardBrand: sub.cardBrand || null,
      cardLast4: sub.cardLast4 || null,
      invoices: sub.invoices || [],
    },
    initials,
    scheduledDeletionAt: userDoc?.scheduledDeletionAt || null,
    deletionConfirmed: userDoc?.deletionConfirmed || false,
  };
}

async function buildAnalyticsViewModel(userId, shortLinkId = null, range = "30", creatorId = null) {
  const { buildUnifiedAnalyticsData } = require("./utils/analyticsHelper");
  return await buildUnifiedAnalyticsData(userId, { shortLinkId, range, creatorId });
}

function isGuestContributor(user) {
  return user?.role === "guest_contributor";
}

function buildEmptyInviteSummary() {
  return { total: 0, pending: 0, accepted: 0, expired: 0 };
}

// ── ROUTES ───────────────────────────────────────────────────────────────────

// Home / services hub
app.get("/", redirectIfAuthenticated, (req, res) => {
  res.render("services-hub", { services });
});

app.get("/services", (req, res) => {
  res.redirect("/");
});

app.get("/terms", (req, res) => {
  res.render("terms");
});
app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/confirm-deletion", (req, res) => {
  res.render("confirm-deletion");
});
app.get("/services/bio-builder", (req, res) => {
  res.render("bio-builder");
});

app.get("/changelog", (req, res) => {
  res.render("changelog");
});

// Dashboard
app.get(
  "/dashboard",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
      ? null
      : await User.findById(req.user.id)
          .select(
            "name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription",
          )
          .lean();

    const inviteSummary = isGuestContributor(req.user)
      ? buildEmptyInviteSummary()
      : await Promise.all([
          Invite.countDocuments({ inviter: req.user.id, status: "pending" }),
          Invite.countDocuments({ inviter: req.user.id, status: "accepted" }),
          Invite.countDocuments({ inviter: req.user.id, status: "expired" }),
        ]).then(([pending, accepted, expired]) => ({
          total: pending + accepted + expired,
          pending,
          accepted,
          expired,
        }));

    const dashboardData = await getDashboardData(userDoc);

    res.render("dashboard", {
      user: buildAccountViewModel(userDoc, req.user),
      services,
      inviteSummary,
      dashboardData,
      inviteAcceptMessage: null,
      inviteAcceptError: null,
    });
  }),
);

// Profile
app.get(
  "/profile",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
      ? null
      : await User.findById(req.user.id).select("name email").lean();

    res.render("profile", { user: buildAccountViewModel(userDoc, req.user) });
  }),
);

// Settings
app.get(
  "/settings",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
      ? null
      : await User.findById(req.user.id)
          .select(
            "name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription scheduledDeletionAt deletionConfirmed",
          )
          .lean();

    res.render("settings", {
      services,
      user: buildAccountViewModel(userDoc, req.user),
      isGuestContributor: isGuestContributor(req.user),
    });
  }),
);

// My Links
app.get(
  "/my-links",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
      ? null
      : await User.findById(req.user.id)
          .select(
            "name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription",
          )
          .lean();

    res.render("my-links", {
      services,
      user: buildAccountViewModel(userDoc, req.user),
      isGuestContributor: isGuestContributor(req.user),
      activeNav: "my-links",
      domain: req.get("host"),
    });
  }),
);
app.get(
  "/inbox",
  protect,
  asyncHandler(async (req, res) => {
    res.render("inbox", {
      services,
      user: req.user,
    });
  }),
);
// Analytics
app.get(
  "/analytics",
  protect,
  asyncHandler(async (req, res) => {
    return res.redirect("/services/analytics-dashboard");
  }),
);

// Vault redirect to new File Upload page
app.get("/vault", protect, (req, res) => {
  return res.redirect("/file-upload");
});
// File Upload page
app.get(
  "/file-upload",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
      .select("name email")
      .lean();

    return res.render("file-upload", {
      services,
      user: buildAccountViewModel(userDoc, req.user),
    });
  }),
);

// ── BIO LINK ROUTES ──

// Editor — creator configures their bio page
app.get(
  "/bio",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
      .select("name email alias bio")
      .lean();

    const bioProfile = userDoc?.alias
      ? await BioProfile.findOne({ userId: req.user.id }).lean()
      : null;

    return res.render("bio-editor", {
      services,
      user: buildAccountViewModel(userDoc, req.user),
      bioProfile: bioProfile || null,
    });
  }),
);

// Preview — creator's own bio page, rendered the same as the public view
app.get(
  "/bio/preview",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
      .select("name email alias")
      .lean();

    const handle = userDoc?.alias;
    if (!handle) {
      return res.redirect("/bio");
    }

    const bioProfile = await BioProfile.findOne({ handle }).lean();

    if (!bioProfile) {
      return res.redirect("/bio");
    }

    const profile = {
      name: bioProfile.name || handle,
      handle,
      bio: bioProfile.bio || "",
      tags: bioProfile.tags || [],
      avatarUrl: bioProfile.avatarUrl || null,
      initials: bioProfile.initials || handle.substring(0, 2).toUpperCase(),
      stats: bioProfile.stats || {
        links: bioProfile.links?.length || 0,
        views: 0,
        clicks: 0,
      },
      theme: bioProfile.theme || "light",
      layout: bioProfile.layout || "list",
      background: bioProfile.background || null,
      contactButton: bioProfile.contactButton?.url
        ? bioProfile.contactButton
        : null,
      seo: {
        title: bioProfile.seo?.title || bioProfile.name || handle,
        description: bioProfile.seo?.description || bioProfile.bio || "",
      },
    };

    const links = bioProfile.links || [];

    return res.render("bio-profile", { profile, links });
  }),
);

// Save bio data
app.post(
  "/bio/save",
  protect,
  asyncHandler(async (req, res) => {
    const BioProfile = require("./model/bioProfile");
    const { validateBioProfileInput } = require("./utils/bioProfileValidation");
    const userDoc = await User.findById(req.user.id);
    if (!userDoc) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const validation = validateBioProfileInput(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ success: false, message: validation.message });
    }

    const {
      handle,
      name,
      bio,
      tags,
      avatarUrl,
      links,
      theme,
      layout,
      background,
      contactButton,
      customDomain,
      seoTitle,
      seoDescription,
    } = validation.data;
    const userHandle = handle || userDoc.alias;

    if (!userHandle) {
      return res
        .status(400)
        .json({ success: false, message: "Handle is required" });
    }

    if (handle && handle !== userDoc.alias) {
      userDoc.alias = handle;
      await userDoc.save();
    }

    const updateData = {
      userId: userDoc._id,
      handle: userHandle,
      name: name || userDoc.name,
      bio: bio || userDoc.bio,
      tags: tags || [],
      avatarUrl: avatarUrl || userDoc.avatar,
      links: links || [],
      ...(theme !== undefined && { theme }),
      ...(layout !== undefined && { layout }),
      ...(background !== undefined && { background }),
      ...(contactButton !== undefined && { contactButton }),
      ...(customDomain !== undefined && { customDomain }),
      ...(seoTitle !== undefined || seoDescription !== undefined
        ? { seo: { title: seoTitle, description: seoDescription } }
        : {}),
    };

    const bioProfile = await BioProfile.findOneAndUpdate(
      { userId: userDoc._id },
      updateData,
      { new: true, upsert: true },
    );

    await invalidateProfileCache(userHandle);

    return res.json({ success: true, data: bioProfile });
  }),
);

// Save theme/layout preference only (lightweight, used by the theme/layout switcher buttons)
app.post(
  "/bio/preferences",
  protect,
  asyncHandler(async (req, res) => {
    const { theme, layout } = req.body;
    const validThemes = ["light", "dark", "neon", "gradient"];
    const validLayouts = ["list", "grid", "cards"];

    const updates = {};
    if (theme !== undefined) {
      if (!validThemes.includes(theme)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid theme" });
      }
      updates.theme = theme;
    }
    if (layout !== undefined) {
      if (!validLayouts.includes(layout)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid layout" });
      }
      updates.layout = layout;
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided" });
    }

    const userDoc = await User.findById(req.user.id).select("alias").lean();
    if (!userDoc || !userDoc.alias) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    const bioProfile = await BioProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true },
    );

    if (!bioProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    await invalidateProfileCache(userDoc.alias);

    return res.json({
      success: true,
      data: { theme: bioProfile.theme, layout: bioProfile.layout },
    });
  }),
);

// Track link click
const clickTrackerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window per IP
  message: { success: false, message: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// IP-based deduplication map: linkId -> Map<ip, timestamp>
const clickCooldowns = new Map();
const CLICK_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per IP per link
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 minutes

// Periodic sweep: removes stale IP entries per link, and removes the
// outer linkId key entirely once its inner map is empty. This prevents
// unbounded growth from deleted links (orphaned linkId keys) and from
// low-traffic links that never hit a per-request cleanup threshold.
const clickCooldownsSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [linkId, linkCooldowns] of clickCooldowns) {
    for (const [ip, timestamp] of linkCooldowns) {
      if (now - timestamp > CLICK_COOLDOWN_MS) {
        linkCooldowns.delete(ip);
      }
    }
    if (linkCooldowns.size === 0) {
      clickCooldowns.delete(linkId);
    }
  }
}, CLEANUP_INTERVAL_MS);
clickCooldownsSweepInterval.unref();

app.post(
  "/bio/track/:linkId",
  clickTrackerLimiter,
  asyncHandler(async (req, res) => {
    const BioProfile = require("./model/bioProfile");
    const { linkId } = req.params;
    const clientIp = req.ip || req.connection.remoteAddress;

    // IP-based deduplication with cooldown
    if (!clickCooldowns.has(linkId)) {
      clickCooldowns.set(linkId, new Map());
    }
    const linkCooldowns = clickCooldowns.get(linkId);
    const lastClick = linkCooldowns.get(clientIp);

    if (lastClick && Date.now() - lastClick < CLICK_COOLDOWN_MS) {
      return res.json({ success: true, tracked: false, reason: "cooldown" });
    }

    linkCooldowns.set(clientIp, Date.now());

    const bioProfile = await BioProfile.findOneAndUpdate(
      { "links._id": linkId },
      { $inc: { "stats.clicks": 1 } },
      { new: true },
    );

    if (!bioProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Link not found" });
    }

    return res.json({ success: true, tracked: true });
  }),
);

// Public profile — anyone can visit creatoros.com/@handle
app.get(
  "/@:handle",
  asyncHandler(async (req, res) => {
    const handle = req.params.handle;

    const cachedResult = await getProfileFromCache(handle);
    if (cachedResult) {
      res.setCacheStatus("HIT");
      const { profile, links } = cachedResult.data;
      return res.render("bio-profile", { profile, links });
    }

    res.setCacheStatus("MISS");

    const bioProfile = await BioProfile.findOne({ handle }).lean();

    if (!bioProfile) {
      return res.status(404).render("404", { url: req.originalUrl });
    }

    const profile = {
      name: bioProfile.name || handle,
      handle,
      bio: bioProfile.bio || "",
      tags: bioProfile.tags || [],
      avatarUrl: bioProfile.avatarUrl || null,
      initials: bioProfile.initials || handle.substring(0, 2).toUpperCase(),
      stats: bioProfile.stats || {
        links: bioProfile.links?.length || 0,
        views: 0,
        clicks: 0,
      },
      theme: bioProfile.theme || "light",
      layout: bioProfile.layout || "list",
      background: bioProfile.background || null,
      contactButton: bioProfile.contactButton?.url
        ? bioProfile.contactButton
        : null,
      seo: {
        title: bioProfile.seo?.title || bioProfile.name || handle,
        description: bioProfile.seo?.description || bioProfile.bio || "",
      },
    };

    const links = bioProfile.links || [];

    const cacheData = { profile, links };
    await setProfileInCache(handle, cacheData);

    return res.render("bio-profile", { profile, links });
  }),
);

// ── SERVICE PAGES ──

app.get(
  "/services/:serviceKey",
  protect,
  asyncHandler(async (req, res) => {
    const service = findServiceByKey(req.params.serviceKey);

    if (!service) {
      return res.status(404).render("coming-soon", {
        service: {
          name: "Unknown service",
          description:
            "This service does not exist in the current module registry.",
          status: "coming_soon",
        },
      });
    }

    if (service.status !== "available") {
      return res.render("coming-soon", { service });
    }

    if (service.key === "url-shortener") {
      return res.render("home", buildShortenerViewModel(req));
    }

    if (service.key === "suggestion-tool") {
      return res.redirect("/suggestions");
    }

    if (service.key === "creator-crm") {
      return res.redirect("/services/creator-crm");
    }

    if (service.key === "content-os") {
      return res.redirect("/services/content-os");
    }

    if (service.key === "analytics-dashboard") {
      const userDoc = await User.findById(req.user.id)
        .select("name email")
        .lean();
      const allCreators = await Creator.find({ userId: req.user.id })
        .select("_id username platform profileUrl avatar")
        .lean();
      const selectedCreatorId =
        req.query.creatorId ||
        (allCreators[0] && allCreators[0]._id.toString());
      const analytics = await buildAnalyticsViewModel(
        req.user.id,
        req.query.link,
        req.query.range || "30",
        selectedCreatorId,
      );
      return res.render("analytics-dashboard", {
        service,
        services,
        user: buildAccountViewModel(userDoc, req.user),
        analytics,
        creators: allCreators,
        selectedCreatorId: selectedCreatorId || null,
      });
    }

    if (service.key === "smart-bio") {
      const userDoc = await User.findById(req.user.id)
        .select("name email alias bio")
        .lean();

      const bioProfile = userDoc?.alias
        ? await BioProfile.findOne({ userId: req.user.id }).lean()
        : null;

      return res.render("bio-editor", {
        service,
        services,
        user: buildAccountViewModel(userDoc, req.user),
        bioProfile: bioProfile || null,
      });
    }

    if (service.key === "file-upload") {
      return res.render("file-upload");
    }

    return res.render("coming-soon", { service });
  }),
);

// ── URL SHORTENER POST ──

const { isValidUrl } = require("./utils/validators");
const { parseVisitCoordinates } = require("./utils/visitTelemetry");
const { parseVisitMeta } = require("./utils/deviceParser");

const { handleGenerateShortUrlRender } = require("./controller/url");
const { handleQrRedirect } = require("./controller/qrCodeController");
app.post(
  "/services/url-shortener/shorten",
  protect,
  preventContributorWrites,
  urlShortenerLimiter,
  handleGenerateShortUrlRender,
);

// ── FILE UPLOAD (VAULT) ROUTES ──
const fileUploadRoutes = require("./routes/fileUpload");
app.use(
  "/services/file-upload",
  protect,
  preventContributorWrites,
  fileUploadRoutes,
);

// ── SHORT URL REDIRECT ──

const bcrypt = require("bcryptjs"); // swap to 'bcrypt' if that's what model/user.js uses

async function recordClickAndRedirect(req, res, entry) {
  const coordinates = parseVisitCoordinates(req.query);
  const visitData = { timestamp: new Date(), source: "direct" };
  if (coordinates) {
    visitData.x = coordinates.x;
    visitData.y = coordinates.y;
  }

  await Url.findOneAndUpdate(
    { shortId: entry.shortId },
    {
      $inc: { totalClicks: 1 },
      $push: {
        visitHistory: {
          $each: [visitData],
          $sort: { timestamp: -1 },
          $slice: 1000,
        },
      },
    },
  );

  return res.redirect(entry.redirectUrl);
}

app.get(
  "/u/:shortId",
  asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;

    try {
      const entry = await Url.findOne({ shortId });
      if (!entry)
        return res.status(404).render("404", { url: req.originalUrl });

      if (entry.archived) {
        return res.status(404).render("404", { url: req.originalUrl });
      }

      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        return res.status(410).render("link-expired", { shortId });
      }

      if (entry.password) {
        return res.render("link-password", { shortId, error: null });
      }
      return await recordClickAndRedirect(req, res, entry);
    } catch (err) {
      console.error("[redirect]", err);
      return res.status(500).send("Server error");
    }
  }),
);

// Password-protected link: verify submitted password, then redirect.
// A POST (not a query param) so the password never lands in the URL,
// browser history, server access logs, or the Referer header.
const linkPasswordAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts, please try again later.",
});

app.post(
  "/u/:shortId",
  linkPasswordAttemptLimiter,
  asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;
    const { password } = req.body;

    const entry = await Url.findOne({ shortId });
    if (!entry) return res.status(404).render("404", { url: req.originalUrl });

    if (entry.archived) {
      return res.status(404).render("404", { url: req.originalUrl });
    }

    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      return res.status(410).render("link-expired", { shortId });
    }

    if (!entry.password) {
      // No password set (e.g. removed between page load and submit) — just proceed.
      return await recordClickAndRedirect(req, res, entry);
    }

    const isMatch =
      password && (await bcrypt.compare(String(password), entry.password));
    if (!isMatch) {
      return res.status(401).render("link-password", {
        shortId,
        error: "Incorrect password. Please try again.",
      });
    }

    return await recordClickAndRedirect(req, res, entry);
  }),
);

app.get("/q/:shortId", handleQrRedirect);

// ── SITEMAP ─────────────────────────────────────────────
app.get("/sitemap.xml", (req, res) => {
  const baseUrl = BRAND.siteUrl;

  const urls = [
    "/",
    "/login",
    "/signup",
    "/services",
    "/dashboard",
    "/profile",
    "/analytics",
    "/vault",
    "/bio",
    "/settings",
    "/suggestions",
    "/my-links",
    "/dm-automation",
    "/services/creator-crm",
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `
    <url>
        <loc>${baseUrl}${url}</loc>
        <changefreq>weekly</changefreq>
        <priority>${url === "/" ? "1.0" : "0.7"}</priority>
    </url>
`,
  )
  .join("")}
</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ── 404 HANDLER ──
app.use((req, res) => {
  res.status(404).render("404", {
    url: req.originalUrl,
  });
});

// ── ERROR HANDLER — must be last ──

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

async function startServer() {
  try {
    // Start the HTTP server immediately
    const server = app.listen(port, () => {
      const url = process.env.APP_URL || `http://localhost:${port}`;
      console.log(`🚀 Server is running on ${url}`);
    });

    // Connect to the database in the background
    await connectDB();
    console.log("✅ Database connected successfully.");

    // Initialize background workers after the database is ready
    require("./workers/analyticsRefreshWorker");
    require("./workers/contentPublishWorker").startContentPublishWorker();
  } catch (error) {
    console.error("❌ Failed to start the application:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
