const express = require('express');
const mongoose = require('mongoose'); // 1. Mongoose import kiya
const app = express();
const path = require('path');
const shortid = require('shortid');
const services = require('./services.config');
const bioLinkRoutes = require('./routes/bioLink'); 
const port = 3000;
const urlRoutes = require('./routes/url');

// In-memory "database" for URL Shortener (Temporary)
const urlDatabase = new Map();

// 2. MongoDB Connection Setup
// Example: Replace <password> with your actual password
const mongoURI = 'mongodb+srv://tanishkameena897_db_user:5Jd33COtEyILkBKm@cluster0.xxxxx.mongodb.net/creatoros?retryWrites=true&w=majority';

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));

// 3. Routes Order Matters!
// Bio Links handle /u/:username and /dashboard/bio
app.use(bioLinkRoutes); 

// URL Shortener specific routes
app.use('/url', urlRoutes);

function findServiceByKey(key) {
    return services.find((service) => service.key === key);
}

function buildShortenerViewModel(req, shortId = null, error = null) {
    return {
        service: findServiceByKey('url-shortener'),
        shortUrl: shortId ? `${req.protocol}://${req.get('host')}/s/${shortId}` : null, // Changed /u/ to /s/ to avoid clash
        error,
    };
}

// Service hub landing page
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

// ⚠️ IMPORTANT: Changed /u/:shortId to /s/:shortId to avoid clash with Bio Links (/u/:username)
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