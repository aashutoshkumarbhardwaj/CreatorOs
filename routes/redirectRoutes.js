const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const Url = require("../model/url");
const asyncHandler = require("../utils/asyncHandler");
const { parseVisitCoordinates } = require("../utils/visitTelemetry");
const { handleQrRedirect } = require("../controller/qrCodeController");

async function recordClickAndRedirect(req, res, entry) {
  const coordinates = parseVisitCoordinates(req.query);
  const visitData = { timestamp: new Date(), source: "direct" };
  if (coordinates) {
    visitData.x = coordinates.x;
    visitData.y = coordinates.y;
  }

  await Url.findOneAndUpdate(
    { shortId: entry.shortId },
    {
      $inc: { totalClicks: 1 },
      $push: {
        visitHistory: {
          $each: [visitData],
          $sort: { timestamp: -1 },
          $slice: 1000,
        },
      },
    }
  );

  return res.redirect(entry.redirectUrl);
}

router.get(
  "/u/:shortId",
  asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;

    try {
      const entry = await Url.findOne({ shortId });
      if (!entry) return res.status(404).render("404", { url: req.originalUrl });

      if (entry.archived) {
        return res.status(404).render("404", { url: req.originalUrl });
      }

      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        return res.status(410).render("link-expired", { shortId });
      }

      if (entry.password) {
        return res.render("link-password", { shortId, error: null });
      }
      return await recordClickAndRedirect(req, res, entry);
    } catch (err) {
      console.error("[redirect]", err);
      return res.status(500).send("Server error");
    }
  })
);

const linkPasswordAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts, please try again later.",
});

router.post(
  "/u/:shortId",
  linkPasswordAttemptLimiter,
  asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;
    const { password } = req.body;

    const entry = await Url.findOne({ shortId });
    if (!entry) return res.status(404).render("404", { url: req.originalUrl });

    if (entry.archived) {
      return res.status(404).render("404", { url: req.originalUrl });
    }

    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      return res.status(410).render("link-expired", { shortId });
    }

    if (!entry.password) {
      return await recordClickAndRedirect(req, res, entry);
    }

    const isMatch = password && (await bcrypt.compare(String(password), entry.password));
    if (!isMatch) {
      return res.status(401).render("link-password", {
        shortId,
        error: "Incorrect password. Please try again.",
      });
    }

    return await recordClickAndRedirect(req, res, entry);
  })
);

router.get("/q/:shortId", handleQrRedirect);

module.exports = router;
