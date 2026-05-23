const express = require('express');
const app = express();
const path = require('path');
const shortid = require('shortid');
const services = require('./services.config');
const bioLinkRoutes = require('./routes/bioLink'); 
const port = 3000;
const urlRoutes = require('./routes/url');

// In-memory "database" to store URLs.
// Note: This data will be lost when the server restarts.
const urlDatabase = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));

app.use('/url', urlRoutes);
app.use('/', bioLinkRoutes); 

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

// Service hub landing page
app.get('/', (req, res) => {
    res.render('services-hub', { services });
});

// Optional convenience route
app.get('/services', (req, res) => {
    res.redirect('/');
});

// Service pages
app.get('/services/:serviceKey', (req, res) => {
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

    return res.render('coming-soon', { service });
});

// URL shortener submit flow (dedicated service route)
app.post('/services/url-shortener/shorten', async (req, res) => {
    const { redirectUrl } = req.body;
    if (!redirectUrl) {
        return res.render('home', buildShortenerViewModel(req, null, 'Please enter a URL.'));
    }

    try {
        const shortId = shortid();

        // Store the new link in our in-memory database
        urlDatabase.set(shortId, {
            redirectUrl,
            totalClicks: 0,
            createdAt: [],
        });

        return res.render('home', buildShortenerViewModel(req, shortId));
    } catch (err) {
        // Log the actual error to the server console for debugging
        console.error('Error creating short URL:', err);
        return res.render('home', buildShortenerViewModel(req, null, 'An unexpected error occurred.'));
    }
});

// Redirect for generated short URLs
app.get('/u/:shortId', async (req, res) => {
    const shortId = req.params.shortId;

    // Find the entry in our in-memory database
    const entry = urlDatabase.get(shortId);

    if (entry) {
        // Update analytics
        entry.totalClicks++;
        entry.createdAt.push({ timeStamp: new Date() });
        return res.redirect(entry.redirectUrl);
    } else {
        return res.status(404).send('URL not found');
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
