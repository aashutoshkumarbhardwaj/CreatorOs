const app = require('./index');
const listEndpoints = require('express-list-endpoints');
try {
    const list = require('express-list-endpoints');
    console.log(list(app).map(r => r.path));
} catch (e) { console.log(e.message); }
