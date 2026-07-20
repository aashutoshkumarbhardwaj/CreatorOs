const asyncHandler = require("../utils/asyncHandler");
const Sponsor = require("../model/sponsor");

const getSponsors = asyncHandler(async (req, res) => {
    const sponsors = await Sponsor.find({ creatorId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: sponsors });
});

const createSponsor = asyncHandler(async (req, res) => {
    const sponsor = await Sponsor.create({ ...req.body, creatorId: req.user._id });
    res.status(201).json({ success: true, data: sponsor });
});

const updateSponsor = asyncHandler(async (req, res) => {
    const sponsor = await Sponsor.findOneAndUpdate(
        { _id: req.params.id, creatorId: req.user._id },
        req.body,
        { new: true, runValidators: true }
    );
    if (!sponsor) return res.status(404).json({ success: false, message: "Sponsor not found" });
    res.json({ success: true, data: sponsor });
});

const deleteSponsor = asyncHandler(async (req, res) => {
    const sponsor = await Sponsor.findOneAndDelete({ _id: req.params.id, creatorId: req.user._id });
    if (!sponsor) return res.status(404).json({ success: false, message: "Sponsor not found" });
    res.json({ success: true, message: "Sponsor deleted" });
});

module.exports = {
    getSponsors,
    createSponsor,
    updateSponsor,
    deleteSponsor
};
