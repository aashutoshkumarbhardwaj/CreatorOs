const SmartBioTheme = require("../model/smartBioTheme");
const { generateCssVariables, isValidLeadEmail, computeBioCtr } = require("../services/smartBioEnhancementService");

/**
 * Configure or update creator's Smart Bio Theme & Widgets
 */
exports.updateBioProfileTheme = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { username, themePreset, customStyles, bioText, avatarUrl, widgets } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: "username is required" });
    }

    const cleanUsername = username.toLowerCase().trim();

    // Ensure username is not claimed by another creator
    const existing = await SmartBioTheme.findOne({ username: cleanUsername });
    if (existing && String(existing.creatorId) !== String(creatorId)) {
      return res.status(409).json({ success: false, message: "Username already taken" });
    }

    let profile = await SmartBioTheme.findOne({ creatorId });
    if (profile) {
      profile.username = cleanUsername;
      if (themePreset) profile.themePreset = themePreset;
      if (customStyles) profile.customStyles = { ...profile.customStyles, ...customStyles };
      if (bioText !== undefined) profile.bioText = bioText;
      if (avatarUrl !== undefined) profile.avatarUrl = avatarUrl;
      if (widgets && Array.isArray(widgets)) profile.widgets = widgets;
      await profile.save();
    } else {
      profile = new SmartBioTheme({
        creatorId,
        username: cleanUsername,
        themePreset: themePreset || "midnight_neon",
        customStyles: customStyles || {},
        bioText: bioText || "",
        avatarUrl: avatarUrl || "",
        widgets: widgets || [],
      });
      await profile.save();
    }

    return res.status(200).json({
      success: true,
      message: "Smart Bio profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error("Bio update error:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile", error: error.message });
  }
};

/**
 * Public Bio Profile Viewer with rendered CSS theme
 */
exports.getPublicBioProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await SmartBioTheme.findOne({ username: username.toLowerCase().trim() });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Smart Bio profile not found" });
    }

    // Increment view count asynchronously
    profile.totalViews += 1;
    await profile.save();

    const cssVariables = generateCssVariables(profile.themePreset, profile.customStyles);

    return res.status(200).json({
      success: true,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      bioText: profile.bioText,
      themePreset: profile.themePreset,
      cssVariables,
      widgets: profile.widgets.sort((a, b) => a.orderIndex - b.orderIndex),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch bio page", error: error.message });
  }
};

/**
 * Submit newsletter lead from public bio page
 */
exports.submitBioLead = async (req, res) => {
  try {
    const { username } = req.params;
    const { email, firstName } = req.body;

    if (!isValidLeadEmail(email)) {
      return res.status(400).json({ success: false, message: "A valid email address is required" });
    }

    const profile = await SmartBioTheme.findOne({ username: username.toLowerCase().trim() });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Bio profile not found" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const alreadySubscribed = profile.leads.some((l) => l.email === cleanEmail);
    if (!alreadySubscribed) {
      profile.leads.push({
        email: cleanEmail,
        firstName: firstName || "",
        collectedAt: new Date(),
      });
      await profile.save();
    }

    return res.status(201).json({
      success: true,
      message: "Thank you for subscribing!",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to collect lead", error: error.message });
  }
};

/**
 * Record widget click
 */
exports.recordWidgetClick = async (req, res) => {
  try {
    const { username, widgetId } = req.params;

    const profile = await SmartBioTheme.findOne({ username: username.toLowerCase().trim() });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Bio not found" });
    }

    profile.totalClicks += 1;
    const widget = profile.widgets.id(widgetId);
    if (widget) {
      widget.clicks += 1;
    }
    await profile.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

/**
 * Get Creator Bio Telemetry & Leads
 */
exports.getBioAnalytics = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const profile = await SmartBioTheme.findOne({ creatorId });

    if (!profile) {
      return res.status(404).json({ success: false, message: "No Smart Bio profile found for creator" });
    }

    const ctr = computeBioCtr(profile.totalViews, profile.totalClicks);

    return res.status(200).json({
      success: true,
      analytics: {
        totalViews: profile.totalViews,
        totalClicks: profile.totalClicks,
        clickThroughRatePercent: ctr,
        totalLeadsCount: profile.leads.length,
        leads: profile.leads.slice(-50), // last 50 leads
        widgetPerformance: profile.widgets.map((w) => ({
          id: w._id,
          title: w.title,
          type: w.widgetType,
          clicks: w.clicks,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch analytics", error: error.message });
  }
};
