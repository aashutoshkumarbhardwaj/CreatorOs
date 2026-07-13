const express = require('express');
const router = express.Router();
const BioProfile = require('../model/bioProfile');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// Add to BioProfile schema: customDomain (already done in model/bioProfile.js)

router.use(protect);

router.post('/save', asyncHandler(async (req, res) => {
    const { handle, name, bio, customDomain, links } = req.body;

    let profile = await BioProfile.findOne({ userId: req.user._id });

    if (profile) {
        profile.handle = handle || profile.handle;
        profile.name = name || profile.name;
        profile.bio = bio || profile.bio;
        profile.customDomain = customDomain || profile.customDomain;
        if (links) profile.links = links;
        await profile.save();
    } else {
        profile = await BioProfile.create({
            userId: req.user._id,
            handle,
            name,
            bio,
            customDomain,
            links: links || []
        });
    }

    res.json({ success: true, data: profile });
}));

module.exports = router;
