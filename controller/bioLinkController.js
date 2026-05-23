const BioLink = require('../model/biolink'); // Check path: '../model/biolink' or '../models/BioLink'

// ─── Dashboard: show editor ───────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const page = await BioLink.findOne({ user: req.user._id });
    res.render('bio/dashboard', { page, user: req.user, error: null, success: null });
  } catch (err) {
    console.error(err);
    res.render('bio/dashboard', { page: null, user: req.user, error: 'Failed to load page.', success: null });
  }
};

// ─── Save profile settings ───────────────────────────────────────────────
exports.savePage = async (req, res) => {
  try {
    const { username, displayName, bio, theme, accentColor, layout } = req.body;

    // Check username uniqueness (exclude current user)
    const existing = await BioLink.findOne({ username, user: { $ne: req.user._id } });
    if (existing) {
      const page = await BioLink.findOne({ user: req.user._id });
      return res.render('bio/dashboard', { page, user: req.user, error: 'That username is already taken.', success: null });
    }

    await BioLink.findOneAndUpdate(
      { user: req.user._id },
      { 
        username, 
        displayName, 
        bio, 
        theme, 
        accentColor, 
        layout, 
        user: req.user._id 
      },
      { upsert: true, new: true, runValidators: true }
    );

    const page = await BioLink.findOne({ user: req.user._id });
    res.render('bio/dashboard', { page, user: req.user, error: null, success: 'Profile saved!' });
  } catch (err) {
    console.error(err);
    const page = await BioLink.findOne({ user: req.user._id });
    res.render('bio/dashboard', { page, user: req.user, error: 'Save failed. Check all fields.', success: null });
  }
};

// ─── Add a link ───────────────────────────────────────────────────────────
exports.addLink = async (req, res) => {
  try {
    const { title, url, icon } = req.body;
    const page = await BioLink.findOne({ user: req.user._id });
    if (!page) return res.redirect('/dashboard/bio');

    page.links.push({ title, url, icon: icon || 'ti-link', order: page.links.length });
    await page.save();
    res.redirect('/dashboard/bio#links');
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard/bio');
  }
};

// ─── Delete a link ────────────────────────────────────────────────────────
exports.deleteLink = async (req, res) => {
  try {
    await BioLink.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { links: { _id: req.params.id } } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Toggle link active state ─────────────────────────────────────────────
exports.toggleLink = async (req, res) => {
  try {
    const page = await BioLink.findOne({ user: req.user._id });
    if (!page) return res.status(404).json({ success: false });
    
    const link = page.links.id(req.params.id);
    if (!link) return res.status(404).json({ success: false });
    
    link.active = !link.active;
    await page.save();
    res.json({ success: true, active: link.active });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ─── Add / update socials ─────────────────────────────────────────────────
exports.saveSocials = async (req, res) => {
  try {
    const platforms = ['twitter', 'instagram', 'youtube', 'github', 'tiktok', 'linkedin'];
    const socials = platforms
      .filter(p => req.body[p] && req.body[p].trim())
      .map(p => ({ platform: p, url: req.body[p].trim() }));

    await BioLink.findOneAndUpdate({ user: req.user._id }, { socials });
    res.redirect('/dashboard/bio#socials');
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard/bio');
  }
};

// ─── Public page ─────────────────────────────────────────────────────────
exports.publicPage = async (req, res) => {
  try {
    const page = await BioLink.findOne({ username: req.params.username, published: true });
    if (!page) return res.status(404).render('404', { message: 'Bio page not found.' });
    res.render('bio/public', { page });
  } catch (err) {
    res.status(500).render('404', { message: 'Something went wrong.' });
  }
};

// ─── Click tracking redirect ──────────────────────────────────────────────
exports.trackClick = async (req, res) => {
  try {
    const page = await BioLink.findOne({ username: req.params.username });
    if (!page) return res.redirect('/');
    
    const link = page.links.id(req.params.linkId);
    if (!link) return res.redirect('/');
    
    link.clicks += 1;
    await page.save();
    
    // Ensure URL has protocol
    let finalUrl = link.url;
    if (!finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
    }
    res.redirect(finalUrl);
  } catch (err) {
    res.redirect('/');
  }
};