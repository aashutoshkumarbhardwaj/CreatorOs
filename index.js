require("dotenv").config({ path: ".env.local" });
const cookieParser = require("cookie-parser");
const express = require('express');
const passport = require("passport");
const path = require('path');
const cacheHeadersMiddleware = require('./middleware/cacheHeaders');
const { getProfileFromCache, setProfileInCache } = require('./utils/profileCache');

// Validate required environment variables
const requiredEnvVars = [
    { name: 'MONGODB_URI', description: 'MongoDB connection string' },
    { name: 'JWT_SECRET', description: 'Secret key for JWT token signing' },
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
const authRoutes = require("./routes/auth");
const collaborationRoutes = require('./routes/collaboration');
const analyticsRoutes = require("./routes/analytics");
const instagramRoutes = require('./routes/instagram');
const { acceptInvite, acceptInviteFromDashboard } = require('./controller/collaborationController');

connectDB();
require("./workers/analyticsRefreshWorker");
require("./workers/contentPublishWorker").startContentPublishWorker();
const { generateCsrf, verifyCsrf } = require('./middleware/csrf');

app.use(cacheHeadersMiddleware);
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
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

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Too many login attempts, please try again later.'
});
app.post('/login', loginLimiter);

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

const protect = require("./middleware/auth");
const { preventContributorWrites } = require("./middleware/auth");

const fs = require('fs');
app.use(express.static(path.join(__dirname, 'public')));
const shortid = require('shortid');
const multer = require('multer');
const services = require('./services.config');
const User = require('./model/user');
const Creator = require('./model/creator');
const Invite = require('./model/invite');
const port = process.env.PORT || 3000;
const urlRoutes = require('./routes/url');
const asyncHandler = require('./utils/asyncHandler');

const suggestionRoutes = require('./routes/suggestionRoutes');
const { getDashboardData } = require('./utils/dashboardHelper');

app.use('/suggestions', protect, suggestionRoutes);
app.use('/services/creator-crm', protect, collaborationRoutes);
app.post('/dashboard/accept-invite', protect, preventContributorWrites, acceptInviteFromDashboard);
app.get('/invites/accept/:token', acceptInvite);
app.get('/services/bio-builder', (req, res) => {
    res.render('bio-builder');
});


const Url = require('./model/url');

app.use('/api/urls', urlRoutes);
// API Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./utils/swaggerOptions');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.min.css' }));

app.use("/api/analytics", protect, analyticsRoutes);
app.use('/api/instagram', protect, instagramRoutes);

const settingsRoutes = require('./routes/settings');
app.use('/api/settings', protect, settingsRoutes);

const contentRoutes = require('./routes/content');
app.use('/api/content', protect, contentRoutes);

const uploadDir = "/tmp";

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, "/tmp"); },
    filename: function (req, file, cb) {
        let sanitizedFilename = path.basename(file.originalname);
        sanitizedFilename = sanitizedFilename.replace(/[/\\?%*:|"<>]/g, '-').replace(/^\.+/, '');
        cb(null, Date.now() + '-' + sanitizedFilename);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

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
    };
}

async function buildAnalyticsViewModel(creatorId) {
    const AnalyticsSnapshot = require('./model/analyticsSnapshot');
    const EngagementHistory = require('./model/engagementHistory');
    const Post = require('./model/post');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [latestSnapshot, history, topPostsRaw, postCount] = await Promise.all([
        AnalyticsSnapshot.findOne({ creatorId }).sort({ createdAt: -1 }).lean(),
        EngagementHistory.find({ creatorId, date: { $gte: thirtyDaysAgo } })
            .sort({ date: 1 })
            .lean(),
        Post.find({ creatorId }).sort({ views: -1 }).limit(5).lean(),
        Post.countDocuments({ creatorId }),
    ]);

    const isEmpty = !latestSnapshot;

    const labels = history.map((h) =>
        new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    // Reconstruct a followers curve from growth deltas, ending at the latest known total
    const endFollowers = latestSnapshot?.followers || 0;
    let running = endFollowers;
    const followersDesc = [...history].reverse().map((h) => {
        const val = running;
        running -= h.followersGrowth || 0;
        return val;
    });
    const followers = followersDesc.reverse();

    const engagement = history.map((h) =>
        Number((h.engagementRateDelta || 0).toFixed(2))
    );

    const topPosts = topPostsRaw.map((p) => {
        const engagementRate = latestSnapshot?.followers
            ? (((p.likes + p.comments) / latestSnapshot.followers) * 100).toFixed(1) + '%'
            : '—';
        return {
            title: p.caption ? p.caption.slice(0, 60) : `${p.platform} post`,
            type: p.platform,
            likes: p.likes,
            comments: p.comments,
            views: p.views,
            engagement: engagementRate,
            date: p.postedAt
                ? new Date(p.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '',
        };
    });

    return {
        isLoading: false,
        isEmpty,
        selectedRange: 'Last 30 days',
        lastUpdated: latestSnapshot?.createdAt
            ? new Date(latestSnapshot.createdAt).toLocaleString('en-US', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
              })
            : '—',
        metrics: [
            { label: 'Followers', value: (latestSnapshot?.followers ?? 0).toLocaleString(), change: '', tone: 'cyan' },
            { label: 'Engagement rate', value: `${(latestSnapshot?.engagementRate ?? 0).toFixed(2)}%`, change: '', tone: 'green' },
            { label: 'Total views', value: (latestSnapshot?.totalViews ?? 0).toLocaleString(), change: '', tone: 'blue' },
            { label: 'Total likes', value: (latestSnapshot?.totalLikes ?? 0).toLocaleString(), change: '', tone: 'orange' },
            { label: 'Total comments', value: (latestSnapshot?.totalComments ?? 0).toLocaleString(), change: '', tone: 'violet' },
            { label: 'Total posts', value: postCount.toLocaleString(), change: '', tone: 'pink' },
        ],
        charts: {
            labels,
            followers,
            engagement,
            posts: topPosts.map((p) => p.title),
            postPerformance: topPosts.map((p) => p.views),
        },
        topPosts,
        timeline: [],
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
app.get('/', (req, res) => {
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
}));

// Profile
app.get("/profile", protect, asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id).select('name email').lean();

    res.render("profile", { user: buildAccountViewModel(userDoc, req.user) });
}));

// Settings
app.get('/settings', protect, asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id)
            .select('name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription')
            .lean();

    res.render('settings', {
        services,
        user: buildAccountViewModel(userDoc, req.user),
        isGuestContributor: isGuestContributor(req.user),
    });
}));

// My Links
app.get('/my-links', protect, asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id)
            .select('name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription')
            .lean();

    res.render('my-links', {
        services,
        user: buildAccountViewModel(userDoc, req.user),
        isGuestContributor: isGuestContributor(req.user),
        activeNav: 'my-links',
        domain: req.get('host'),
    });
}));

// Analytics
app.get('/analytics', protect, asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
        .select('name email')
        .lean();

    return res.render('analytics', {
        services,
        user: buildAccountViewModel(userDoc, req.user),
    });
}));

// Vault redirect to new File Upload page
app.get('/vault', protect, (req, res) => {
    return res.redirect('/file-upload');
});
// File Upload page
app.get('/file-upload', protect, asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
        .select('name email')
        .lean();

    return res.render('file-upload', {
        services,
        user: buildAccountViewModel(userDoc, req.user),
    });
}));

// ── BIO LINK ROUTES ──

// Editor — creator configures their bio page
app.get('/bio', protect, asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
        .select('name email alias bio')
        .lean();

    return res.render('bio-editor', {
        services,
        user: buildAccountViewModel(userDoc, req.user),
    });
}));

// Save bio data
app.post('/bio/save', protect, asyncHandler(async (req, res) => {
    // Wire to BioProfile model later
    return res.json({ success: true });
}));

// Track link click
app.post('/bio/track/:linkId', asyncHandler(async (req, res) => {
    // Wire to analytics later
    return res.json({ tracked: true });
}));

// Public profile — anyone can visit creatoros.com/@handle
app.get('/@:handle', asyncHandler(async (req, res) => {
    const handle = req.params.handle;

    const cachedResult = await getProfileFromCache(handle);
    if (cachedResult) {
        res.setCacheStatus('HIT');
        const { profile, links } = cachedResult.data;
        return res.render('bio-profile', { profile, links });
    }

    res.setCacheStatus('MISS');

    // Replace with DB lookup when BioProfile model is ready:
    // const bioProfile = await BioProfile.findOne({ handle }).lean();

    const profile = {
        name: 'Sudeepti Singh',
        handle,
        bio: 'AI/ML Enthusiast | Creator | B.Tech CS @ JUET',
        tags: ['AI/ML', 'Creator', 'Open Source'],
        avatarUrl: null,
        initials: 'SS',
        stats: { links: 6, views: '1.2K', clicks: '342' },
    };

    const links = [
        { id: 1, type: 'instagram', icon: '📸', label: 'Instagram',  url: 'https://instagram.com/', category: 'social' },
        { id: 2, type: 'youtube',   icon: '🎥', label: 'YouTube',    url: 'https://youtube.com/',   category: 'social' },
        { id: 3, type: 'github',    icon: '💻', label: 'GitHub',     url: 'https://github.com/',    category: 'work'   },
        { id: 4, type: 'linkedin',  icon: '💼', label: 'LinkedIn',   url: 'https://linkedin.com/',  category: 'work'   },
        { id: 5, type: 'portfolio', icon: '🌐', label: 'Portfolio',  url: 'https://portfolio.dev/', category: 'work'   },
        { id: 6, type: 'email',     icon: '📧', label: 'Contact Me', url: 'mailto:hello@example.com', category: 'other' },
    ];

    const cacheData = { profile, links };
    await setProfileInCache(handle, cacheData);

    return res.render('bio-profile', { profile, links });
}));

// ── SERVICE PAGES ──

app.get('/services/:serviceKey', protect, asyncHandler(async (req, res) => {
    const service = findServiceByKey(req.params.serviceKey);

    if (!service) {
        return res.status(404).render('coming-soon', {
            service: {
                name: 'Unknown service',
                description: 'This service does not exist in the current module registry.',
                status: 'coming_soon',
            },
        });
    }

    if (service.status !== 'available') {
        return res.render('coming-soon', { service });
    }

    if (service.key === 'url-shortener') {
        return res.render('home', buildShortenerViewModel(req));
    }

    if (service.key === 'suggestion-tool') {
        return res.redirect('/suggestions');
    }

    if (service.key === 'creator-crm') {
        return res.redirect('/services/creator-crm');
    }

   if (service.key === 'analytics-dashboard') {
        const userDoc = await User.findById(req.user.id)
            .select('name email')
            .lean();
        const creatorDoc = await Creator.findOne({ userId: req.user.id }).lean();
        const analytics = creatorDoc
            ? await buildAnalyticsViewModel(creatorDoc._id)
            : { isLoading: false, isEmpty: true, metrics: [], charts: { labels: [], followers: [], engagement: [] }, topPosts: [] };
        return res.render('analytics-dashboard', {
            service,
            services,
            user: buildAccountViewModel(userDoc, req.user),
            analytics,
        });
    }

    if (service.key === 'smart-bio') {
        const userDoc = await User.findById(req.user.id)
            .select('name email alias bio')
            .lean();

        return res.render('bio-editor', {
            service,
            services,
            user: buildAccountViewModel(userDoc, req.user),
        });
    }

    if (service.key === 'file-upload') {
        return res.render('file-upload');
    }

    return res.render('coming-soon', { service });
}));

// ── URL SHORTENER POST ──

const { isValidUrl } = require('./utils/validators');

const { handleGenerateShortUrlRender } = require('./controller/url');
app.post('/services/url-shortener/shorten', protect, preventContributorWrites, urlShortenerLimiter, handleGenerateShortUrlRender);

// ── FILE UPLOAD POST ──

app.post('/services/file-upload/upload', protect, preventContributorWrites, uploadLimiter, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.filename,
    });

    // Clean up temporary file to prevent DoS via disk exhaustion
    try {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error(`[upload] Failed to delete temp file ${req.file.path}:`, err);
        });
    } catch (e) {
        console.error(`[upload] Error deleting temp file:`, e);
    }
});

// ── SHORT URL REDIRECT ──

app.get('/u/:shortId', asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;

    try {
        const entry = await Url.findOneAndUpdate(
            { shortId },
            {
                $inc:  { totalClicks: 1 },
                $push: {
                    visitHistory: {
                        $each: [{ timestamp: new Date(), source: 'direct' }],
                        $sort: { timestamp: -1 },
                        $slice: 1000,
                    },
                },
            },
            { new: true }
        );

        if (!entry) return res.status(404).send('URL not found');
        return res.redirect(entry.redirectUrl);
    } catch (err) {
        console.error('[redirect]', err);
        return res.status(500).send('Server error');
    }
}));

// ── SITEMAP ─────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
    const baseUrl = BRAND.siteUrl;

    const urls = [
        '/',
        '/login',
        '/signup',
        '/services',
        '/dashboard',
        '/profile',
        '/analytics',
        '/vault',
        '/bio',
        '/settings',
        '/suggestions',
        '/my-links',
        '/dm-automation',
        '/services/creator-crm'
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `
    <url>
        <loc>${baseUrl}${url}</loc>
        <changefreq>weekly</changefreq>
        <priority>${url === '/' ? '1.0' : '0.7'}</priority>
    </url>
`).join('')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
});

// ── 404 HANDLER ──
app.use((req, res) => {
    res.status(404).render('404', {
        url: req.originalUrl
    });
});

// ── ERROR HANDLER — must be last ──

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

if (require.main === module) {
    app.listen(port, (error) => {
        if (error) {
            console.error(`Failed to start server on port ${port}: ${error.message}`);
            process.exit(1);
        }

        const url = process.env.APP_URL || `http://localhost:${port}`;
        console.log(`Server is running on ${url}`);
    });
}

module.exports = app;
