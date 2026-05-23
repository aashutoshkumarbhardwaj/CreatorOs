const express = require('express');
const router  = express.Router();
const ctrl    = require('../controller/bioLinkController'); // Controller ko import kiya

// NOTE: Agar auth middleware nahi hai, toh neeche wali line comment out kardo ya temporary middleware banao
const isLoggedIn = require('../middleware/auth'); 

// ─ Protected dashboard routes ────────────────────────────────────────────
router.get ('/dashboard/bio',              isLoggedIn, ctrl.getDashboard);
router.post('/dashboard/bio/save',         isLoggedIn, ctrl.savePage); // Note: savePage, not saveProfile
router.post('/dashboard/bio/link/add', 
router.get('/dashboard/bio', isLoggedIn, ctrl.getDashboard),   isLoggedIn, ctrl.addLink);
router.delete('/dashboard/bio/link/:id',   isLoggedIn, ctrl.deleteLink);
router.patch('/dashboard/bio/link/:id/toggle', isLoggedIn, ctrl.toggleLink);
router.post('/dashboard/bio/socials',      isLoggedIn, ctrl.saveSocials);

// ── Public routes ────────────────────────────────────────────────────────
router.get('/u/:username',                 ctrl.publicPage);
router.get('/u/:username/go/:linkId',      ctrl.trackClick);

module.exports = router;