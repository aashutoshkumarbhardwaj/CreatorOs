const dotenv = require("dotenv");
dotenv.config();
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local", override: true });
}
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const passport = require("passport");
const path = require("path");
const rateLimit = require("express-rate-limit");
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
const domainRoute = require("./routes/domain");
const sponsorRoute = require("./routes/sponsor");
const settingsRoutes = require("./routes/settings");
const contentRoutes = require("./routes/content");
const suggestionRoutes = require("./routes/suggestionRoutes");
const qrCodeRoutes = require("./routes/qrCode");
const smartNotificationRoutes = require("./routes/smartNotificationRoutes");

const { generateCsrf, verifyCsrf } = require("./middleware/csrf");

app.use(
  helmet({
    contentSecurityPolicy: false, // Disabling CSP by default so we don't break existing inline scripts/styles without testing
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
app.use(generateCsrf);
app.use(verifyCsrf);
app.use(passport.initialize());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "view"));
app.locals.BRAND = BRAND;

// Generate a per-request nonce for inline scripts (used by CSP below and
// exposed to views via res.locals.nonce)
const crypto = require("crypto");
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

// Content Security Policy (CSP) header - defense-in-depth against XSS
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${res.locals.nonce}' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; object-src 'none'; frame-src 'none';`,
  );
  next();
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Upload limit reached, please try again later." },
});

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

const fs = require("fs");
app.use(express.static(path.join(__dirname, "public")));
const shortid = require("shortid");
const multer = require("multer");
const services = require("./services.config");
const User = require("./model/user");
const Creator = require("./model/creator");
const Invite = require("./model/invite");
const BioProfile = require("./model/bioProfile");
const Url = require("./model/url");
const port = process.env.PORT || 3000;
const asyncHandler = require("./utils/asyncHandler");

const {
  acceptInvite,
  acceptInviteFromDashboard,
} = require("./controller/collaborationController");
const { getDashboardData } = require("./utils/dashboardHelper");

app.use("/suggestions", protect, suggestionRoutes);
app.use("/services/creator-crm", protect, collaborationRoutes);
app.use("/services/qr-code-generator", qrCodeRoutes);
app.use("/", smartNotificationRoutes);
app.post(
  "/dashboard/accept-invite",
  protect,
  preventContributorWrites,
  acceptInviteFromDashboard,
);
app.get("/invites/accept/:token", acceptInvite);

// Billing & Domain Routes

// API Routes
app.use("/api/billing", billingRoute);
app.use("/api/domain", domainRoute);
app.use("/api/sponsors", sponsorRoute);
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

const os = require("os");
const uploadDir = os.tmpdir();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    let sanitizedFilename = path.basename(file.originalname);
    sanitizedFilename = sanitizedFilename
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/^\.+/, "");
    cb(null, Date.now() + "-" + sanitizedFilename);
  },
});

const fileFilter = (req, file, cb) => {
  const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (
    !ALLOWED_MIME_TYPES.includes(file.mimetype) ||
    !ALLOWED_EXTENSIONS.includes(fileExtension)
  ) {
    return cb(
      new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed."),
      false,
    );
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: fileFilter,
});

const sharp = require('sharp');

async function compressImage(filePath, mimetype) {
    // GIFs are skipped — sharp's default pipeline doesn't preserve animation
    if (mimetype === 'image/gif') {
        return { compressed: false };
    }

    const tempOutputPath = filePath + '.compressed';
    const originalStats = fs.statSync(filePath);

    try {
        const pipeline = sharp(filePath).resize({
            width: 1920,
            height: 1920,
            fit: 'inside',
            withoutEnlargement: true,
        });

        if (mimetype === 'image/jpeg') {
            pipeline.jpeg({ quality: 80 });
        } else if (mimetype === 'image/png') {
            pipeline.png({ quality: 80, compressionLevel: 8 });
        } else if (mimetype === 'image/webp') {
            pipeline.webp({ quality: 80 });
        }

        await pipeline.toFile(tempOutputPath);

        const compressedStats = fs.statSync(tempOutputPath);

        // Only keep the compressed version if it's actually smaller
        if (compressedStats.size < originalStats.size) {
            fs.renameSync(tempOutputPath, filePath);
            return { compressed: true, originalSize: originalStats.size, newSize: compressedStats.size };
        } else {
            fs.unlinkSync(tempOutputPath);
            return { compressed: false, originalSize: originalStats.size, newSize: originalStats.size };
        }
    } catch (err) {
        console.error('[compress] Failed to compress image:', err);
        if (fs.existsSync(tempOutputPath)) {
            fs.unlinkSync(tempOutputPath);
        }
        return { compressed: false, originalSize: originalStats.size, newSize: originalStats.size };
    }
}

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
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        d.setDate(24);
        return d;
      })();

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
      planName: sub.planName || "Pro Individual",
      priceMonthly: sub.priceMonthly ?? 29,
      nextInvoiceLabel: nextInvoice.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      estimatedTotal: `$${(sub.priceMonthly ?? 29).toFixed(2)} USD`,
      cardBrand: sub.cardBrand || "VISA",
      cardLast4: sub.cardLast4 || "4242",
      invoices: [
        {
          date: "Sep 24, 2023",
          invoiceId: "#INV-88219",
          amount: "$29.00",
          status: "PAID",
        },
        {
          date: "Aug 24, 2023",
          invoiceId: "#INV-87112",
          amount: "$29.00",
          status: "PAID",
        },
      ],
    },
    initials,
    scheduledDeletionAt: userDoc?.scheduledDeletionAt || null,
    deletionConfirmed: userDoc?.deletionConfirmed || false,
  };
}

async function buildAnalyticsViewModel(userId, shortLinkId = null) {
  const Url = require("./model/url");

  let query = { userId };
  if (shortLinkId) {
    query.shortId = shortLinkId;
  }

  let userUrls = await Url.find(query).lean();
  if (
    (!userUrls || userUrls.length === 0) &&
    process.env.USE_MOCK_DB === "true"
  ) {
    userUrls = await Url.find(
      shortLinkId ? { shortId: shortLinkId } : {},
    ).lean();
  }

  // Group visitHistory by day
  const labels = [];
  const followers = [];
  const engagement = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    );
    followers.push(0);
    engagement.push(0);
  }

  userUrls.forEach((url) => {
    if (url.visitHistory) {
      url.visitHistory.forEach((visit) => {
        const visitDate = new Date(visit.timestamp || visit.date || new Date());
        const diffTime = Math.abs(new Date() - visitDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 30) {
          const idx = 29 - diffDays;
          if (idx >= 0 && idx < 30) {
            followers[idx]++;
            if (visit.source === "direct" || !visit.source) {
              engagement[idx]++;
            }
          }
        }
      });
    }
  });

  const linkPosts = (userUrls || [])
    .map((u) => ({
      title: u.title || u.redirectUrl?.slice(0, 50) || "Shortlink",
      type: u.tag ? u.tag.toUpperCase() : "LINK",
      likes: "—",
      comments: "—",
      views: u.totalClicks || 0,
      engagement: `${u.totalClicks || 0} clicks`,
      date: u.createdAt
        ? new Date(u.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "Today",
    }))
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 10);

  return {
    isLoading: false,
    isEmpty: userUrls.length === 0,
    selectedRange: "Last 30 days",
    lastUpdated: new Date().toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    metrics: [],
    charts: {
      labels,
      followers,
      engagement,
      posts: linkPosts.map((p) => p.title),
      postPerformance: linkPosts.map((p) => p.views),
    },
    topPosts: linkPosts,
  };
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

// Periodic cleanup every 5 minutes to prevent unbounded memory growth
setInterval(
  () => {
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
  },
  5 * 60 * 1000,
);

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

const { handleGenerateShortUrlRender } = require("./controller/url");
const { handleQrRedirect } = require("./controller/qrCodeController");
app.post(
  "/services/url-shortener/shorten",
  protect,
  preventContributorWrites,
  urlShortenerLimiter,
  handleGenerateShortUrlRender,
);

// ── FILE UPLOAD POST ──

app.post(
  "/services/file-upload/upload",
  protect,
  preventContributorWrites,
  uploadLimiter,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const compressionResult = await compressImage(req.file.path, req.file.mimetype);
    const finalStats = fs.statSync(req.file.path);

    res.json({
      filename: req.file.originalname,
      size: finalStats.size,
      mimetype: req.file.mimetype,
      path: req.file.filename,
      compressed: compressionResult.compressed,
    });

    // Clean up temporary file to prevent DoS via disk exhaustion
    try {
      fs.unlink(req.file.path, (err) => {
        if (err)
          console.error(
            `[upload] Failed to delete temp file ${req.file.path}:`,
            err,
          );
      });
    } catch (e) {
      console.error(`[upload] Error deleting temp file:`, e);
    }
  },
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
