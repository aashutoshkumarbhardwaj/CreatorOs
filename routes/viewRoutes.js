const express = require('express');
const router = express.Router();
const User = require('../model/user');
const Invite = require('../model/invite');
const Creator = require('../model/creator');
const BioProfile = require('../model/bioProfile');
const { protect, preventContributorWrites, redirectIfAuthenticated } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { getDashboardData } = require('../utils/dashboardHelper');
const { invalidateProfileCache } = require('../utils/profileCache');
const services = require('../services.config');
const rateLimit = require('express-rate-limit');
const { findServiceByKey, buildAccountViewModel, buildShortenerViewModel, buildAnalyticsViewModel, isGuestContributor, buildEmptyInviteSummary } = require('../utils/viewHelpers');

const urlShortenerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: 'Too many URLs generated, please try again later.' });

router.get("/", redirectIfAuthenticated, (req, res) => {
  res.render("services-hub", { services });
});

router.get("/services", (req, res) => {
  res.redirect("/");
});

router.get("/terms", (req, res) => {
  res.render("terms");
});

router.get("/privacy", (req, res) => {
  res.render("privacy-policy");
});

router.get("/about", (req, res) => {
  res.render("about");
});

router.get("/confirm-deletion", (req, res) => {
  res.render("confirm-deletion");
});
router.get("/services/bio-builder", (req, res) => {
  res.render("bio-builder");
});

router.get("/changelog", (req, res) => {
  res.render("changelog");
});

// Dashboard
router.get(
  "/dashboard",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
      ? null
      : await User.findById(req.user.id)
          .select(
            "name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription",
          )
          .lean();

    const inviteSummary = isGuestContributor(req.user)
      ? buildEmptyInviteSummary()
      : await Promise.all([
          Invite.countDocuments({ inviter: req.user.id, status: "pending" }),
          Invite.countDocuments({ inviter: req.user.id, status: "accepted" }),
          Invite.countDocuments({ inviter: req.user.id, status: "expired" }),
        ]).then(([pending, accepted, expired]) => ({
          total: pending + accepted + expired,
          pending,
          accepted,
          expired,
        }));

    const dashboardData = await getDashboardData(userDoc);

    res.render("dashboard", {
      user: buildAccountViewModel(userDoc, req.user),
      services,
      inviteSummary,
      dashboardData,
      inviteAcceptMessage: null,
      inviteAcceptError: null,
    });
  }),
);

// Profile
router.get(
  "/profile",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
      ? null
      : await User.findById(req.user.id).select("name email").lean();

    res.render("profile", { user: buildAccountViewModel(userDoc, req.user) });
  }),
);

// Settings
router.get(
  "/settings",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
      ? null
      : await User.findById(req.user.id)
          .select(
            "name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription scheduledDeletionAt deletionConfirmed",
          )
          .lean();

    res.render("settings", {
      services,
      user: buildAccountViewModel(userDoc, req.user),
      isGuestContributor: isGuestContributor(req.user),
    });
  }),
);

// My Links
router.get(
  "/my-links",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
      ? null
      : await User.findById(req.user.id)
          .select(
            "name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription",
          )
          .lean();

    res.render("my-links", {
      services,
      user: buildAccountViewModel(userDoc, req.user),
      isGuestContributor: isGuestContributor(req.user),
      activeNav: "my-links",
      domain: req.get("host"),
    });
  }),
);
router.get(
  "/inbox",
  protect,
  asyncHandler(async (req, res) => {
    res.render("inbox", {
      services,
      user: req.user,
    });
  }),
);
// Analytics
router.get(
  "/analytics",
  protect,
  asyncHandler(async (req, res) => {
    return res.redirect("/services/analytics-dashboard");
  }),
);

// Vault redirect to new File Upload page
router.get("/vault", protect, (req, res) => {
  return res.redirect("/file-upload");
});
// File Upload page
router.get(
  "/file-upload",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
      .select("name email")
      .lean();

    return res.render("file-upload", {
      services,
      user: buildAccountViewModel(userDoc, req.user),
    });
  }),
);

// ── BIO LINK ROUTES ──
// Editor — creator configures their bio page
router.get(
  "/bio",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
      .select("name email alias bio")
      .lean();

    const bioProfile = userDoc?.alias
      ? await BioProfile.findOne({ userId: req.user.id }).lean()
      : null;

    return res.render("bio-editor", {
      services,
      user: buildAccountViewModel(userDoc, req.user),
      bioProfile: bioProfile || null,
    });
  }),
);

// Preview — creator's own bio page, rendered the same as the public view
router.get(
  "/bio/preview",
  protect,
  asyncHandler(async (req, res) => {
    const userDoc = await User.findById(req.user.id)
      .select("name email alias")
      .lean();

    const handle = userDoc?.alias;
    if (!handle) {
      return res.redirect("/bio");
    }

    const bioProfile = await BioProfile.findOne({ handle }).lean();

    if (!bioProfile) {
      return res.redirect("/bio");
    }

    const profile = {
      name: bioProfile.name || handle,
      handle,
      bio: bioProfile.bio || "",
      tags: bioProfile.tags || [],
      avatarUrl: bioProfile.avatarUrl || null,
      initials: bioProfile.initials || handle.substring(0, 2).toUpperCase(),
      stats: bioProfile.stats || {
        links: bioProfile.links?.length || 0,
        views: 0,
        clicks: 0,
      },
      theme: bioProfile.theme || "light",
      layout: bioProfile.layout || "list",
      background: bioProfile.background || null,
      contactButton: bioProfile.contactButton?.url
        ? bioProfile.contactButton
        : null,
      seo: {
        title: bioProfile.seo?.title || bioProfile.name || handle,
        description: bioProfile.seo?.description || bioProfile.bio || "",
      },
    };

    const links = bioProfile.links || [];

    return res.render("bio-profile", { profile, links });
  }),
);

// Save bio data
router.post(
  "/bio/save",
  protect,
  asyncHandler(async (req, res) => {
    const BioProfile = require("./model/bioProfile");
    const { validateBioProfileInput } = require("./utils/bioProfileValidation");
    const userDoc = await User.findById(req.user.id);
    if (!userDoc) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const validation = validateBioProfileInput(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ success: false, message: validation.message });
    }

    const {
      handle,
      name,
      bio,
      tags,
      avatarUrl,
      links,
      theme,
      layout,
      background,
      contactButton,
      customDomain,
      seoTitle,
      seoDescription,
    } = validation.data;
    const userHandle = handle || userDoc.alias;

    if (!userHandle) {
      return res
        .status(400)
        .json({ success: false, message: "Handle is required" });
    }

    if (handle && handle !== userDoc.alias) {
      userDoc.alias = handle;
      await userDoc.save();
    }

    const updateData = {
      userId: userDoc._id,
      handle: userHandle,
      name: name || userDoc.name,
      bio: bio || userDoc.bio,
      tags: tags || [],
      avatarUrl: avatarUrl || userDoc.avatar,
      links: links || [],
      ...(theme !== undefined && { theme }),
      ...(layout !== undefined && { layout }),
      ...(background !== undefined && { background }),
      ...(contactButton !== undefined && { contactButton }),
      ...(customDomain !== undefined && { customDomain }),
      ...(seoTitle !== undefined || seoDescription !== undefined
        ? { seo: { title: seoTitle, description: seoDescription } }
        : {}),
    };

    const bioProfile = await BioProfile.findOneAndUpdate(
      { userId: userDoc._id },
      updateData,
      { new: true, upsert: true },
    );

    await invalidateProfileCache(userHandle);

    return res.json({ success: true, data: bioProfile });
  }),
);

// Save theme/layout preference only (lightweight, used by the theme/layout switcher buttons)
router.post(
  "/bio/preferences",
  protect,
  asyncHandler(async (req, res) => {
    const { theme, layout } = req.body;
    const validThemes = ["light", "dark", "neon", "gradient"];
    const validLayouts = ["list", "grid", "cards"];

    const updates = {};
    if (theme !== undefined) {
      if (!validThemes.includes(theme)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid theme" });
      }
      updates.theme = theme;
    }
    if (layout !== undefined) {
      if (!validLayouts.includes(layout)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid layout" });
      }
      updates.layout = layout;
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided" });
    }

    const userDoc = await User.findById(req.user.id).select("alias").lean();
    if (!userDoc || !userDoc.alias) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    const bioProfile = await BioProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true },
    );

    if (!bioProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    await invalidateProfileCache(userDoc.alias);

    return res.json({
      success: true,
      data: { theme: bioProfile.theme, layout: bioProfile.layout },
    });
  }),
);

// Track link click
const clickTrackerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window per IP
  message: { success: false, message: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// IP-based deduplication map: linkId -> Map<ip, timestamp>
const clickCooldowns = new Map();
const CLICK_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per IP per link
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 minutes

// Periodic sweep: removes stale IP entries per link, and removes the
// outer linkId key entirely once its inner map is empty. This prevents
// unbounded growth from deleted links (orphaned linkId keys) and from
// low-traffic links that never hit a per-request cleanup threshold.
const clickCooldownsSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [linkId, linkCooldowns] of clickCooldowns) {
    for (const [ip, timestamp] of linkCooldowns) {
      if (now - timestamp > CLICK_COOLDOWN_MS) {
        linkCooldowns.delete(ip);
      }
    }
    if (linkCooldowns.size === 0) {
      clickCooldowns.delete(linkId);
    }
  }
}, CLEANUP_INTERVAL_MS);
clickCooldownsSweepInterval.unref();

// ── SERVICE PAGES ──

router.get(
  "/services/:serviceKey",
  protect,
  asyncHandler(async (req, res) => {
    const service = findServiceByKey(req.params.serviceKey);

    if (!service) {
      return res.status(404).render("coming-soon", {
        service: {
          name: "Unknown service",
          description:
            "This service does not exist in the current module registry.",
          status: "coming_soon",
        },
      });
    }

    if (service.status !== "available") {
      return res.render("coming-soon", { service });
    }

    if (service.key === "url-shortener") {
      return res.render("home", buildShortenerViewModel(req));
    }

    if (service.key === "suggestion-tool") {
      return res.redirect("/suggestions");
    }

    if (service.key === "creator-crm") {
      return res.redirect("/services/creator-crm");
    }

    if (service.key === "content-os") {
      return res.redirect("/services/content-os");
    }

    if (service.key === "analytics-dashboard") {
      const userDoc = await User.findById(req.user.id)
        .select("name email")
        .lean();
      const allCreators = await Creator.find({ userId: req.user.id })
        .select("_id username platform profileUrl avatar")
        .lean();
      const selectedCreatorId =
        req.query.creatorId ||
        (allCreators[0] && allCreators[0]._id.toString());
      const analytics = await buildAnalyticsViewModel(
        req.user.id,
        req.query.link,
        req.query.range || "30",
        selectedCreatorId,
      );
      return res.render("analytics-dashboard", {
        service,
        services,
        user: buildAccountViewModel(userDoc, req.user),
        analytics,
        creators: allCreators,
        selectedCreatorId: selectedCreatorId || null,
      });
    }

    if (service.key === "smart-bio") {
      const userDoc = await User.findById(req.user.id)
        .select("name email alias bio")
        .lean();

      const bioProfile = userDoc?.alias
        ? await BioProfile.findOne({ userId: req.user.id }).lean()
        : null;

      return res.render("bio-editor", {
        service,
        services,
        user: buildAccountViewModel(userDoc, req.user),
        bioProfile: bioProfile || null,
      });
    }

    if (service.key === "file-upload") {
      return res.render("file-upload");
    }

    if (service.key === "sponsorship-calculator") {
      return res.render("sponsorship-calculator", {
        service,
        services,
        user: buildAccountViewModel(null, req.user),
      });
    }

    return res.render("coming-soon", { service });
  }),
);

// ── URL SHORTENER POST ──

const { isValidUrl } = require("../utils/validators");
const { parseVisitCoordinates } = require("../utils/visitTelemetry");
const { parseVisitMeta } = require("../utils/deviceParser");

const { handleGenerateShortUrlRender } = require("../controller/url");
const { handleQrRedirect } = require("../controller/qrCodeController");
router.post(
  "/services/url-shortener/shorten",
  protect,
  preventContributorWrites,
  urlShortenerLimiter,
  handleGenerateShortUrlRender,
);

// ── FILE UPLOAD (VAULT) ROUTES ──

module.exports = router;
