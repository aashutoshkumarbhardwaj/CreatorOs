const shortid = require('shortid');
const Url = require('../model/url');
const { isValidUrl } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');

const handleGenerateShortUrl = asyncHandler(async (req, res) => {
    const body= req.body;
    if(!body.redirectUrl || !isValidUrl(body.redirectUrl)){
        return res.status(400).json({error: "A valid HTTP or HTTPS redirectUrl is required"});
    }
    const ShortId= shortid();
    
    await Url.create({
        shortId: ShortId,
        redirectUrl: body.redirectUrl,
    });

    return res.json({id: ShortId});
});

const handleGetAnalytics = asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;
    const entry = await Url.findOne({ shortId: shortId });
    if (!entry) {
        return res.status(404).json({ error: "Short URL not found" });
    }
    return res.json({
        totalClicks: entry.totalClicks,
        analytics: entry.createdAt
    });
});

module.exports = { handleGenerateShortUrl ,
    handleGetAnalytics
};
