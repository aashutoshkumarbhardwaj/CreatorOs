require('dotenv').config();
const express = require('express');
const connectDB = require('./connect');
console.log("DEBUG: Using MongoDB URI:", process.env.MONGODB_URI);
const app = express();
const path = require('path');
const shortid = require('shortid');
const services = require('./services.config');
const bioLinkRoutes = require('./routes/bioLink'); 
const urlRoutes = require('./routes/url');

const port = 3000;

// MongoDB Connection Setup
connectDB();
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));

// In-memory "database" for URL Shortener
const urlDatabase = new Map();

// Routes
app.use(bioLinkRoutes); 
app.use('/url', urlRoutes);

// Helper Functions
function findServiceByKey(key) {
    return services.find((service) => service.key === key);
}

function buildShortenerViewModel(req, shortId = null, error = null) {
    return {
        service: findServiceByKey('url-shortener'),
        shortUrl: shortId ? `${req.protocol}://${req.get('host')}/s/${shortId}` : null,
        error,
    };
}

// Landing Page
app.get('/', (req, res) => {
    res.render('services-hub', { services });
});

app.get('/services', (req, res) => {
    res.redirect('/');
});

// Service pages
app.get('/services/:serviceKey', (req, res) => {
    const service = findServiceByKey(req.params.serviceKey);

    if (!service) {
        return res.status(404).render('coming-soon', {
            service: { name: 'Unknown service', description: 'Not found.', status: 'coming_soon' },
        });
    }

    if (service.status !== 'available') {
        return res.render('coming-soon', { service });
    }

    if (service.key === 'url-shortener') {
        return res.render('home', buildShortenerViewModel(req));
    }

    return res.render('coming-soon', { service });
});

// URL shortener submit flow
app.post('/services/url-shortener/shorten', async (req, res) => {
    const { redirectUrl } = req.body;
    if (!redirectUrl) {
        return res.render('home', buildShortenerViewModel(req, null, 'Please enter a URL.'));
    }

    try {
        const shortId = shortid();
        urlDatabase.set(shortId, {
            redirectUrl,
            totalClicks: 0,
            createdAt: [],
        });
        return res.render('home', buildShortenerViewModel(req, shortId));
    } catch (err) {
        console.error('Error creating short URL:', err);
        return res.render('home', buildShortenerViewModel(req, null, 'An unexpected error occurred.'));
    }
});

// URL Redirection
app.get('/s/:shortId', async (req, res) => {
    const shortId = req.params.shortId;
    const entry = urlDatabase.get(shortId);

    if (entry) {
        entry.totalClicks++;
        entry.createdAt.push({ timeStamp: new Date() });
        return res.redirect(entry.redirectUrl);
    } else {
        return res.status(404).send('URL not found');
    }
});

app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});