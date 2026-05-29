require("dotenv").config({ path: ".env.local" });
const cookieParser = require("cookie-parser");
const express = require('express');
const passport = require("passport");
const path = require('path');

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

const connectDB = require("./connect");
const authRoutes = require("./routes/auth");
const collaborationRoutes = require('./routes/collaboration');
const analyticsRoutes = require("./routes/analytics");
const { acceptInvite, acceptInviteFromDashboard } = require('./controller/collaborationController');

connectDB();
require("./workers/analyticsRefreshWorker");
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(passport.initialize());

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'view'));

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
const Invite = require('./model/invite');
const port = process.env.PORT || 3000;
const urlRoutes = require('./routes/url');
const asyncHandler = require('./utils/asyncHandler');

const suggestionRoutes = require('./routes/suggestionRoutes');

app.use('/suggestions', protect, suggestionRoutes);
app.use('/services/creator-crm', protect, collaborationRoutes);
app.post('/dashboard/accept-invite', protect, preventContributorWrites, acceptInviteFromDashboard);
app.get('/invites/accept/:token', acceptInvite);

const Url = require('./model/url');

// ── CHANGE 1: /url → /api/urls (QR routes bhi yahan se serve honge) ──────────
app.use('/api/urls', urlRoutes);

app.use("/api/analytics", protect, analyticsRoutes);
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', protect, settingsRoutes);

const uploadDir = "/tmp";

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, "/tmp"); },
    filename: function (req, file, cb) { 
        // 100% foolproof sanitization to prevent any path traversal cross-platform
        let sanitizedFilename = path.basename(file.originalname);
        sanitizedFilename = sanitizedFilename.replace(/[/\\?%*:|"<>]/g, '-').replace(/^\.+/, '');
        cb(null, Date.now() + '-' + sanitizedFilename); 
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

function findServiceByKey(key) {
    return services.find((service) => service.key === key);
}

function buildShortenerViewModel(req, shortId = null, error = null) {
    return {
        service: findServiceByKey('url-shortener'),
        shortUrl: shortId ? `${req.protocol}://${req.get('host')}/u/${shortId}` : null,
        error,
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

function buildAnalyticsViewModel() {
    return {
        isLoading: false,
        isEmpty: false,
        selectedRange: 'Last 30 days',
        lastUpdated: '25 May 2026, 5:30 PM',
        profile: {
            name: 'Aarav Studio',
            handle: '@aaravstudio',
            category: 'Digital creator',
            bio: 'Short-form creator sharing design systems, creator workflows, and behind-the-scenes builds.',
            avatarInitials: 'AS',
            followers: '128.4K',
            following: '642',
            totalPosts: '318',
            growthLabel: '+8.6%',
        },
        metrics: [
            { label: 'Followers', value: '128.4K', change: '+8.6%', tone: 'cyan' },
            { label: 'Engagement rate', value: '6.82%', change: '+1.2%', tone: 'green' },
            { label: 'Avg. likes', value: '8.7K', change: '+940', tone: 'blue' },
            { label: 'Avg. comments', value: '412', change: '+38', tone: 'orange' },
            { label: 'Posting frequency', value: '5.4/wk', change: 'Consistent', tone: 'violet' },
            { label: 'Best post', value: '14.9%', change: 'Engagement', tone: 'pink' },
        ],
        charts: {
            labels: ['Apr 26', 'May 1', 'May 6', 'May 11', 'May 16', 'May 21', 'May 25'],
            followers: [113200, 115400, 118900, 120500, 123300, 126100, 128400],
            engagement: [5.4, 5.9, 6.1, 5.7, 6.4, 6.6, 6.82],
            posts: ['Launch reel', 'Carousel tips', 'Studio vlog', 'Template drop', 'AMA clip'],
            postPerformance: [14900, 12100, 9800, 8700, 7600],
        },
        topPosts: [
            { title: 'How I plan 30 days of content', type: 'Reel', likes: '14.2K', comments: '612', engagement: '14.9%', date: '24 May' },
            { title: 'Creator OS desk setup walkthrough', type: 'Carousel', likes: '11.8K', comments: '488', engagement: '12.4%', date: '22 May' },
            { title: '5 hooks that increased watch time', type: 'Reel', likes: '9.6K', comments: '371', engagement: '10.1%', date: '19 May' },
            { title: 'Behind the scenes: newsletter build', type: 'Post', likes: '7.4K', comments: '284', engagement: '8.7%', date: '16 May' },
        ],
        timeline: [
            { title: 'Top post detected', detail: 'Planning reel crossed 14.9% engagement.', time: 'Today, 4:20 PM' },
            { title: 'Audience growth spike', detail: 'Followers increased by 2.3K over the last 48 hours.', time: 'Today, 11:10 AM' },
            { title: 'Weekly consistency check', detail: 'Posting cadence stayed above 5 posts per week.', time: 'Yesterday' },
            { title: 'Profile snapshot saved', detail: 'Mock analytics snapshot prepared for dashboard UI.', time: '24 May' },
        ],
    };
}


function isGuestContributor(user) {
    return user?.role === 'guest_contributor';
}

function buildEmptyInviteSummary() {
    return {
        total: 0,
        pending: 0,
        accepted: 0,
        expired: 0,
    };
}

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

    res.render("dashboard", {
        user: buildAccountViewModel(userDoc, req.user),
        services,
        inviteSummary,
        inviteAcceptMessage: null,
        inviteAcceptError: null,
    });
}));

app.get("/profile", protect, asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id).select('name email').lean();

    res.render("profile", { user: buildAccountViewModel(userDoc, req.user) });
}));

app.get('/', (req, res) => {
    res.render('services-hub', { services });
});

app.get('/services', (req, res) => {
    res.redirect('/');
});

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
        const userDoc = await User.findById(req.user.id).select('name email').lean();

        return res.render('analytics-dashboard', {
            service,
            services,
            user: buildAccountViewModel(userDoc, req.user),
            analytics: buildAnalyticsViewModel(),
        });
    }

    if (service.key === 'file-upload') {
        return res.render('file-upload');
    }

    return res.render('coming-soon', { service });
}));

const { isValidUrl } = require('./utils/validators');

app.post('/services/url-shortener/shorten', protect, preventContributorWrites, urlShortenerLimiter, async (req, res) => {
    const { redirectUrl } = req.body;
    if (!redirectUrl || !isValidUrl(redirectUrl)) {
        return res.render('home', buildShortenerViewModel(req, null, 'Please enter a valid HTTP or HTTPS URL.'));
    }

    try {
        const shortId = shortid();

        await Url.create({
            shortId,
            redirectUrl,
        });

        return res.render('home', buildShortenerViewModel(req, shortId));
    } catch (err) {
        console.error('Error creating short URL:', err);
        return res.render('home', buildShortenerViewModel(req, null, 'An unexpected error occurred.'));
    }
});

app.post('/services/file-upload/upload', protect, preventContributorWrites, uploadLimiter, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    return res.json({
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.filename,
    });
});

// Redirect for generated short URLs
app.get('/u/:shortId', asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;

    try {
        const entry = await Url.findOneAndUpdate(
            { shortId },
            {
                $inc:  { totalClicks: 1 },
                $push: { visitHistory: { timestamp: new Date(), source: 'direct' } },
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

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

module.exports = app;
