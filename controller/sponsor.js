const asyncHandler = require("../utils/asyncHandler");
const Sponsor = require("../model/sponsor");

function getAuthenticatedUserId(req) {
    return req.user?.id || req.user?._id;
}

function requireAuthenticatedUserId(req, res) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return null;
    }
    return userId;
}

const getSponsors = asyncHandler(async (req, res) => {
    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    const sponsors = await Sponsor.find({ creatorId: userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: sponsors });
});

const ALLOWED_SPONSOR_FIELDS = ['companyName', 'contactName', 'contactEmail', 'status', 'value', 'notes'];

function pickSponsorFields(body) {
    const picked = {};
    for (const field of ALLOWED_SPONSOR_FIELDS) {
        if (body[field] !== undefined) {
            picked[field] = body[field];
        }
    }
    return picked;
}

const createSponsor = asyncHandler(async (req, res) => {
    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    const sponsor = await Sponsor.create({ ...pickSponsorFields(req.body), creatorId: userId });
    res.status(201).json({ success: true, data: sponsor });
});

const updateSponsor = asyncHandler(async (req, res) => {
    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    const sponsor = await Sponsor.findOneAndUpdate(
        { _id: req.params.id, creatorId: userId },
        { $set: pickSponsorFields(req.body) },
        { new: true, runValidators: true }
    );
    if (!sponsor) return res.status(404).json({ success: false, message: "Sponsor not found" });
    res.json({ success: true, data: sponsor });
});

const deleteSponsor = asyncHandler(async (req, res) => {
    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    const sponsor = await Sponsor.findOneAndDelete({ _id: req.params.id, creatorId: userId });
    if (!sponsor) return res.status(404).json({ success: false, message: "Sponsor not found" });
    res.json({ success: true, message: "Sponsor deleted" });
});

module.exports = {
    getSponsors,
    createSponsor,
    updateSponsor,
    deleteSponsor
};
