const BioProfile = require('../model/bioProfile');
const User = require('../model/user');
const asyncHandler = require('../utils/asyncHandler');

const RESERVED_HANDLES = new Set([
    'admin', 'login', 'signup', 'dashboard', 'bio', 'api', 'services', 
    'invites', 'logout', 'settings', 'profile', 'health', 'docs', 'auth', 
    'billing', 'domain', 'suggestions', 'analytics', 'instagram', 'sponsors', 
    'content', 'urls', 'ai', 'css', 'js', 'images', 'public', 'favicon.ico',
    'support', 'help', 'terms', 'privacy', 'about', 'contact', 'home'
]);

/**
 * Clean & normalize handle format
 */
function sanitizeHandle(rawHandle) {
    if (!rawHandle) return '';
    return rawHandle.trim().toLowerCase().replace(/^@/, '');
}

/**
 * Validate handle constraints
 */
function validateHandle(handle) {
    if (!handle) return { valid: false, message: 'Handle is required' };
    const clean = sanitizeHandle(handle);
    if (clean.length < 3) return { valid: false, message: 'Handle must be at least 3 characters long' };
    if (clean.length > 30) return { valid: false, message: 'Handle must be at most 30 characters long' };
    if (!/^[a-z0-9_-]+$/.test(clean)) return { valid: false, message: 'Handle can only contain letters, numbers, hyphens, and underscores' };
    if (RESERVED_HANDLES.has(clean)) return { valid: false, message: 'This handle is reserved' };
    return { valid: true, clean };
}

/**
 * Render Smart Bio Editor with creator's saved profile
 */
const renderBioEditor = asyncHandler(async (req, res) => {
    const services = require('../services.config');
    const { buildAccountViewModel } = require('./auth');

    const userDoc = await User.findById(req.user.id).select('name email alias bio avatar').lean();
    if (!userDoc) {
        return res.status(404).render('404', { url: req.originalUrl });
    }

    let bioProfile = await BioProfile.findOne({ userId: req.user.id }).lean();

    if (!bioProfile) {
        const defaultHandle = userDoc.alias || userDoc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
        bioProfile = {
            userId: userDoc._id,
            handle: defaultHandle,
            name: userDoc.name,
            bio: userDoc.bio || '',
            tags: [],
            avatarUrl: userDoc.avatar || null,
            theme: 'light',
            layout: 'list',
            socials: [],
            links: [],
            stats: { links: 0, views: 0, clicks: 0 }
        };
    }

    return res.render('bio-editor', {
        services,
        user: buildAccountViewModel ? buildAccountViewModel(userDoc, req.user) : userDoc,
        bioProfile
    });
});

/**
 * Save / Update Bio Profile
 */
const saveBioProfile = asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id);
    if (!userDoc) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { handle, name, bio, tags, avatarUrl, links, theme, layout, socials } = req.body;
    const requestedHandle = handle || userDoc.alias || userDoc.name;
    const handleValidation = validateHandle(requestedHandle);

    if (!handleValidation.valid) {
        return res.status(400).json({ success: false, message: handleValidation.message });
    }

    const cleanHandle = handleValidation.clean;

    // Check handle collision with other users
    const existingProfile = await BioProfile.findOne({
        handle: cleanHandle,
        userId: { $ne: userDoc._id }
    });

    if (existingProfile) {
        return res.status(400).json({ success: false, message: 'Handle is already taken by another user' });
    }

    // Keep user's alias synchronized
    if (userDoc.alias !== cleanHandle) {
        userDoc.alias = cleanHandle;
        await userDoc.save();
    }

    const initials = (name || userDoc.name || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    const formattedLinks = Array.isArray(links) ? links.map((l, index) => ({
        type: l.type || 'custom',
        icon: l.icon || '🔗',
        label: l.label || 'Link',
        url: l.url || '#',
        category: l.category || 'other',
        clicks: l.clicks || 0,
        isEnabled: l.isEnabled !== undefined ? l.isEnabled : true,
        order: l.order !== undefined ? l.order : index
    })) : [];

    const updateData = {
        userId: userDoc._id,
        handle: cleanHandle,
        name: name || userDoc.name,
        bio: bio !== undefined ? bio : (userDoc.bio || ''),
        tags: Array.isArray(tags) ? tags : [],
        avatarUrl: avatarUrl !== undefined ? avatarUrl : (userDoc.avatar || null),
        initials,
        theme: ['light', 'dark', 'neon', 'gradient'].includes(theme) ? theme : 'light',
        layout: ['list', 'grid', 'cards'].includes(layout) ? layout : 'list',
        socials: Array.isArray(socials) ? socials : [],
        links: formattedLinks,
        'stats.links': formattedLinks.length
    };

    const bioProfile = await BioProfile.findOneAndUpdate(
        { userId: userDoc._id },
        { $set: updateData },
        { new: true, upsert: true, runValidators: true }
    );

    return res.json({ success: true, data: bioProfile });
});

/**
 * Check handle availability real-time
 */
const checkHandleAvailability = asyncHandler(async (req, res) => {
    const rawHandle = req.params.handle;
    const validation = validateHandle(rawHandle);

    if (!validation.valid) {
        return res.json({ available: false, reason: validation.message });
    }

    const existing = await BioProfile.findOne({
        handle: validation.clean,
        userId: req.user ? { $ne: req.user.id } : { $exists: true }
    });

    if (existing) {
        return res.json({ available: false, reason: 'Handle is already taken' });
    }

    return res.json({ available: true, handle: validation.clean });
});

/**
 * Render Public Bio Profile for @handle, /bio/:handle, /u/:handle, or /:handle
 */
const renderPublicBioProfile = asyncHandler(async (req, res, next) => {
    const rawHandle = req.params.handle;
    const cleanHandle = sanitizeHandle(rawHandle);

    // If handle is a reserved system keyword, pass to next route handler if next is available
    if (RESERVED_HANDLES.has(cleanHandle)) {
        if (typeof next === 'function') return next();
        return res.status(404).render('404', { url: req.originalUrl });
    }

    const bioProfile = await BioProfile.findOne({ handle: cleanHandle }).lean();

    if (!bioProfile) {
        if (typeof next === 'function') return next();
        return res.status(404).render('404', { url: req.originalUrl });
    }

    // Atomically increment views count asynchronously (non-blocking)
    BioProfile.updateOne(
        { _id: bioProfile._id },
        { $inc: { "stats.views": 1 } }
    ).catch(err => console.error('Failed to increment bio view count:', err));

    const profile = {
        name: bioProfile.name || cleanHandle,
        username: bioProfile.handle,
        handle: bioProfile.handle,
        bio: bioProfile.bio || '',
        tags: bioProfile.tags || [],
        avatarUrl: bioProfile.avatarUrl || null,
        initials: bioProfile.initials || cleanHandle.substring(0, 2).toUpperCase(),
        theme: bioProfile.theme || 'light',
        layout: bioProfile.layout || 'list',
        stats: bioProfile.stats || { links: bioProfile.links?.length || 0, views: 0, clicks: 0 },
        socials: bioProfile.socials || []
    };

    const links = (bioProfile.links || []).filter(l => l.isEnabled !== false);

    return res.render('bio-profile', { profile, links });
});

/**
 * Track link click count
 */
const trackLinkClick = asyncHandler(async (req, res) => {
    const { linkId } = req.params;

    const bioProfile = await BioProfile.findOneAndUpdate(
        { "links._id": linkId },
        { $inc: { "stats.clicks": 1, "links.$.clicks": 1 } },
        { new: true }
    );

    if (!bioProfile) {
        return res.status(404).json({ success: false, message: 'Link not found' });
    }

    return res.json({ success: true, tracked: true });
});

module.exports = {
    renderBioEditor,
    saveBioProfile,
    checkHandleAvailability,
    renderPublicBioProfile,
    trackLinkClick,
    validateHandle,
    RESERVED_HANDLES
};
