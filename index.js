const dotenv = require("dotenv");
dotenv.config();
if (process.env.NODE_ENV !== "production") {
    dotenv.config({ path: ".env.local", override: true });
}
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const passport = require("passport");
const path = require('path');
const rateLimit = require('express-rate-limit');
const cacheHeadersMiddleware = require('./middleware/cacheHeaders');
const { getProfileFromCache, setProfileInCache, invalidateProfileCache } = require('./utils/profileCache');

// Validate required environment variables
const requiredEnvVars = [
    { name: 'MONGODB_URI', description: 'MongoDB connection string' },
    { name: 'JWT_SECRET', description: 'Secret key for JWT token signing' },
    { name: 'INSTAGRAM_WEBHOOK_VERIFY_TOKEN', description: 'Instagram webhook verification token' },
    { name: 'INSTAGRAM_APP_SECRET', description: 'Instagram app secret for webhook signature verification' },
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v.name]);

if (missingVars.length > 0) {
    console.warn('\n⚠️ Missing environment variables for full production mode:');
    missingVars.forEach((v) => {
        console.warn(`   - ${v.name} (${v.description})`);
    });
    console.warn('\n📋 The app will start in local mock mode.');
    console.warn('   To use a real database, copy .env.example to .env.local and fill in the values.\n');
}

const app = express();
const { BRAND } = require('./utils/brand');
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
const collaborationRoutes = require('./routes/collaboration');
const aiRoute = require("./routes/ai");
const authRoutes = require("./routes/auth");
const instagramRoutes = require('./routes/instagram');
const billingRoute = require('./routes/billing');
const { handleWebhook: handleBillingWebhook } = require('./controller/billing');
const domainRoute = require('./routes/domain');
const sponsorRoute = require('./routes/sponsor');
const settingsRoutes = require('./routes/settings');
const contentRoutes = require('./routes/content');
const suggestionRoutes = require('./routes/suggestionRoutes');
const qrCodeRoutes = require('./routes/qrCode');
const smartNotificationRoutes = require('./routes/smartNotificationRoutes');

const { generateCsrf, verifyCsrf } = require('./middleware/csrf');

app.use(helmet({
    contentSecurityPolicy: false, // Disabling CSP by default so we don't break existing inline scripts/styles without testing
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(cacheHeadersMiddleware);
app.use(cookieParser());
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleBillingWebhook);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
// Fix for Vercel Serverless: req.query is a getter, so direct assignment throws TypeError.
app.use((req, res, next) => {
    ['body', 'params', 'headers', 'query'].forEach(key => {
        if (req[key]) {
            const sanitized = mongoSanitize.sanitize(req[key], { replaceWith: '_' });
            try {
                req[key] = sanitized;
            } catch (e) {
                // If assignment fails (e.g., getter-only on Vercel), use Object.defineProperty
                Object.defineProperty(req, key, {
                    value: sanitized,
                    writable: true,
                    enumerable: true,
                    configurable: true
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
app.set('views', path.join(__dirname, 'view'));
app.locals.BRAND = BRAND;

// Generate a per-request nonce for inline scripts (used by CSP below and
// exposed to views via res.locals.nonce)
const crypto = require('crypto');
app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
});

// Content Security Policy (CSP) header - defense-in-depth against XSS
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        `default-src 'self'; script-src 'self' 'nonce-${res.locals.nonce}' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; object-src 'none'; frame-src 'none';`
    );
    next();
});
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Upload limit reached, please try again later.' }
});

const urlShortenerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: 'Too many URLs generated, please try again later.'
});

app.use("/", authRoutes);

const { protect, preventContributorWrites, redirectIfAuthenticated } = require("./middleware/auth");

const fs = require('fs');
app.use(express.static(path.join(__dirname, 'public')));
const shortid = require('shortid');
const multer = require('multer');
const services = require('./services.config');
const User = require('./model/user');
const Creator = require('./model/creator');
const Invite = require('./model/invite');
const BioProfile = require('./model/bioProfile');
const Url = require('./model/url');
const port = process.env.PORT || 3000;
const asyncHandler = require('./utils/asyncHandler');

const { acceptInvite, acceptInviteFromDashboard } = require('./controller/collaborationController');
const { getDashboardData } = require('./utils/dashboardHelper');

app.use('/suggestions', protect, suggestionRoutes);
app.use('/services/creator-crm', protect, collaborationRoutes);
app.use('/services/qr-code-generator', qrCodeRoutes);
app.use('/', smartNotificationRoutes);
app.post('/dashboard/accept-invite', protect, preventContributorWrites, acceptInviteFromDashboard);
app.get('/invites/accept/:token', acceptInvite);


// Billing & Domain Routes

// API Routes
app.use('/api/billing', billingRoute);
app.use('/api/domain', domainRoute);
app.use('/api/sponsors', sponsorRoute);
app.use('/api/settings', protect, settingsRoutes);
app.use('/api/content', protect, contentRoutes);

app.use('/api/urls', protect, urlRoutes);
app.use('/api/ai', aiRoute);
app.use('/api/analytics', protect, analyticsRoutes);
app.use('/api/instagram', instagramRoutes);

// API Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./utils/swaggerOptions');

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.min.css',
  })
);

const os = require('os');
const uploadDir = os.tmpdir();

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        let sanitizedFilename = path.basename(file.originalname);
        sanitizedFilename = sanitizedFilename.replace(/[/\\?%*:|"<>]/g, '-').replace(/^\.+/, '');
        cb(null, Date.now() + '-' + sanitizedFilename);
    }
});

const fileFilter = (req, file, cb) => {
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        return cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed.'), false);
    }

    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: fileFilter
});

// ── HELPERS ──────────────────────────────────────────────────────────────────

function findServiceByKey(key) {
    return services.find((service) => service.key === key);
}

function buildShortenerViewModel(req, shortId = null, error = null) {
    return {
        service: findServiceByKey('url-shortener'),
        services,
        shortUrl: shortId ? `${req.protocol}://${req.get('host')}/u/${shortId}` : null,
        error,
        user: buildAccountViewModel(null, req.user)
    };
}

function buildAccountViewModel(userDoc, fallbackUser) {
    const name = userDoc?.name || fallbackUser?.name || 'Creator';
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'CR';

    const passwordChangedAt = userDoc?.passwordChangedAt || userDoc?.updatedAt || null;
    let passwordAgeDays = null;
    if (passwordChangedAt) {
        passwordAgeDays = Math.max(
            0,
            Math.floor((Date.now() - new Date(passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24))
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
        email: userDoc?.email || fallbackUser?.email || '',
        alias: userDoc?.alias || '',
        bio: userDoc?.bio || '',
        twoFactorEnabled: userDoc?.twoFactorEnabled || false,
        preferences: userDoc?.preferences || {
            appearanceMode: 'light',
            interfaceDensity: 'tactile',
            motionEffects: true,
            soundCues: false,
            autoSaveLinks: true
        },
        passwordAgeDays,
        billing: {
            planName: sub.planName || 'Pro Individual',
            priceMonthly: sub.priceMonthly ?? 29,
            nextInvoiceLabel: nextInvoice.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }),
            estimatedTotal: `$${(sub.priceMonthly ?? 29).toFixed(2)} USD`,
            cardBrand: sub.cardBrand || 'VISA',
            cardLast4: sub.cardLast4 || '4242',
            invoices: [
                { date: 'Sep 24, 2023', invoiceId: '#INV-88219', amount: '$29.00', status: 'PAID' },
                { date: 'Aug 24, 2023', invoiceId: '#INV-87112', amount: '$29.00', status: 'PAID' },
            ],
        },
        initials,
        scheduledDeletionAt: userDoc?.scheduledDeletionAt || null,
        deletionConfirmed: userDoc?.deletionConfirmed || false,
    };
}

async function buildAnalyticsViewModel(userId, shortLinkId = null) {
    const Url = require('./model/url');

    let query = { userId };
    if (shortLinkId) {
        query.shortId = shortLinkId;
    }
    
    let userUrls = await Url.find(query).lean();
    if ((!userUrls || userUrls.length === 0) && process.env.USE_MOCK_DB === 'true') {
        userUrls = await Url.find(shortLinkId ? { shortId: shortLinkId } : {}).lean();
    }
    
    // Group visitHistory by day
    const labels = [];
    const followers = [];
    const engagement = [];
    
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        followers.push(0);
        engagement.push(0);
    }
    
    userUrls.forEach(url => {
        if (url.visitHistory) {
            url.visitHistory.forEach(visit => {
                const visitDate = new Date(visit.timestamp || visit.date || new Date());
                const diffTime = Math.abs(new Date() - visitDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < 30) {
                    const idx = 29 - diffDays;
                    if (idx >= 0 && idx < 30) {
                        followers[idx]++;
                        if (visit.source === 'direct' || !visit.source) {
                            engagement[idx]++;
                        }
                    }
                }
            });
        }
    });

    const linkPosts = (userUrls || []).map((u) => ({
        title: u.title || u.redirectUrl?.slice(0, 50) || 'Shortlink',
        type: u.tag ? u.tag.toUpperCase() : 'LINK',
        likes: '—',
        comments: '—',
        views: u.totalClicks || 0,
        engagement: `${u.totalClicks || 0} clicks`,
        date: u.createdAt
            ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'Today',
    })).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);

    return {
        isLoading: false,
        isEmpty: userUrls.length === 0,
        selectedRange: 'Last 30 days',
        lastUpdated: new Date().toLocaleString('en-US', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
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
    return user?.role === 'guest_contributor';
}

function buildEmptyInviteSummary() {
    return { total: 0, pending: 0, accepted: 0, expired: 0 };
}

// ── ROUTES ───────────────────────────────────────────────────────────────────

// Home / services hub
app.get('/', redirectIfAuthenticated, (req, res) => {
    res.render('services-hub', { services });
});

app.get('/services', (req, res) => {
    res.redirect('/');
});

app.get('/terms', (req, res) => {
    res.render('terms');
});
app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/confirm-deletion', (req, res) => {
    res.render('confirm-deletion');
});
app.get('/services/bio-builder', (req, res) => {
    res.render('bio-builder');
});

app.get('/changelog', (req, res) => {
    res.render('changelog');
});

// Dashboard
app.get("/dashboard", protect, asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id)
            .select('name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription')
            .lean();

    const inviteSummary = isGuestContributor(req.user)
        ? buildEmptyInviteSummary()
        : await Promise.all([
            Invite.countDocuments({ inviter: req.user.id, status: 'pending' }),
            Invite.countDocuments({ inviter: req.user.id, status: 'accepted' }),
            Invite.countDocuments({ inviter: req.user.id, status: 'expired' })
        ]).then(([pending, accepted, expired]) => ({
        .catch(err => console.error(err))