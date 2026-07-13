const express = require('express');
const router = express.Router();
const Sponsor = require('../model/sponsor');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// Ensure all routes are protected (require auth)
router.use(protect);

// GET /api/crm/sponsors
router.get('/sponsors', asyncHandler(async (req, res) => {
    // We assume req.user is populated by protect and user has a creator profile.
    // In this MVP, we link sponsor to the userId directly or let's use the Creator ID.
    // If we just use req.user._id as creatorId for simplicity:
    const sponsors = await Sponsor.find({ creatorId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: sponsors });
}));

// POST /api/crm/sponsors
router.post('/sponsors', asyncHandler(async (req, res) => {
    const { name, company, email, status, dealValue, notes } = req.body;

    const sponsor = await Sponsor.create({
        creatorId: req.user._id,
        name,
        company,
        email,
        status,
        dealValue,
        notes
    });

    res.status(201).json({ success: true, data: sponsor });
}));

// PUT /api/crm/sponsors/:id
router.put('/sponsors/:id', asyncHandler(async (req, res) => {
    let sponsor = await Sponsor.findById(req.params.id);

    if (!sponsor) {
        return res.status(404).json({ success: false, message: 'Sponsor not found' });
    }

    if (sponsor.creatorId.toString() !== req.user._id.toString()) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    sponsor = await Sponsor.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.json({ success: true, data: sponsor });
}));

// DELETE /api/crm/sponsors/:id
router.delete('/sponsors/:id', asyncHandler(async (req, res) => {
    const sponsor = await Sponsor.findById(req.params.id);

    if (!sponsor) {
        return res.status(404).json({ success: false, message: 'Sponsor not found' });
    }

    if (sponsor.creatorId.toString() !== req.user._id.toString()) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    await sponsor.deleteOne();

    res.json({ success: true, data: {} });
}));

module.exports = router;
