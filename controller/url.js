const { nanoid } = require("nanoid");
const shortid = require("shortid");
const QRCode = require("qrcode");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // swap to 'bcrypt' if that's what model/user.js uses
const Url = require("../model/url");
const { isValidUrl } = require("../utils/validators");
const asyncHandler = require("../utils/asyncHandler");

const MAX_TAGS_PER_LINK = 10;
const BCRYPT_SALT_ROUNDS = 10;

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [
    ...new Set(
      tags
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 30),
    ),
  ].slice(0, MAX_TAGS_PER_LINK);
}

const DEFAULT_LINK_LIST_LIMIT = 20;
const MAX_LINK_LIST_LIMIT = 100;

function parseListLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LINK_LIST_LIMIT;
  return Math.min(parsed, MAX_LINK_LIST_LIMIT);
}

function isPrivateIP(ip) {
    if (net.isIPv6(ip)) {
        return ip === '::1' || ip === '0:0:0:0:0:0:0:1';
    }
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 100.64.0.0/10 (CGNAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 198.18.0.0/15 (benchmarking)
    if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return true;
    return false;
}

function isSSRFBlocked(hostname) {
    // Block bare IP addresses in private ranges
    if (net.isIP(hostname)) {
        return isPrivateIP(hostname);
    }
    return false;
}

async function validateURL(urlString) {
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch {
        throw new Error('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS URLs are allowed');
    }

    const hostname = parsed.hostname.toLowerCase();

    if (isSSRFBlocked(hostname)) {
        throw new Error('URL points to a private or internal network address');
    }

    // Resolve hostname to IP addresses and check each one
    const addresses = await new Promise((resolve) => {
        dns.lookup(hostname, { all: true }, (err, addrs) => {
            if (err) resolve([]);
            else resolve(addrs.map(a => a.address));
        });
    });

    for (const addr of addresses) {
        if (isPrivateIP(addr)) {
            throw new Error('URL resolves to a private or internal network address');
        }
    }
}

async function fetchWebsiteTitle(url, fallback) {
  if (fallback) return fallback;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timeoutId);
    if (!response.ok) return deriveTitle(url);
    const text = await response.text();
    const match = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (match && match[1]) {
      return match[1].trim().replace(/\s+/g, " ");
    }
    return deriveTitle(url);
  } catch (e) {
    return deriveTitle(url);
  }
}

/**
 * @function deriveTitle
 * @description Extracts or derives a meaningful title from a given URL.
 * @returns {any}
 */
function deriveTitle(redirectUrl, fallback) {
  if (fallback) return fallback;
  try {
    const parsed = new URL(redirectUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    let slug = parts.pop();
    if (
      slug &&
      ["description", "index", "home", "page"].includes(slug.toLowerCase())
    ) {
      slug = parts.pop() || slug;
    }
    if (slug) {
      return slug
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return parsed.hostname.replace("www.", "");
  } catch (_) {
    return "Untitled Link";
  }
}

/**
 * @function formatClicks
 * @description Formats raw click count numbers into a human-readable string (e.g., 1.2k).
 * @returns {any}
 */
function formatClicks(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

/**
 * @function serializeLink
 * @description Serializes a link object for API responses.
 * @returns {any}
 */
function serializeLink(entry, hostBase) {
  const linkedAt =
    entry.linkedAt || entry.createdAt?.[0]?.timeStamp || new Date();
  return {
    shortId: entry.shortId,
    redirectUrl: entry.redirectUrl,
    title: entry.title || deriveTitle(entry.redirectUrl),
    tag: entry.tag || "active",
    tags: entry.tags || [],
    totalClicks: entry.totalClicks || 0,
    clicksLabel: formatClicks(entry.totalClicks || 0),
    shortUrl: `${hostBase}/u/${entry.shortId}`,
    linkedAt: linkedAt,
    linkedAtLabel: new Date(linkedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    expiresAt: entry.expiresAt || null,
    isExpired: entry.expiresAt ? new Date(entry.expiresAt) < new Date() : false,
    hasPassword: !!entry.password,
    archived: !!entry.archived,
    favorite: !!entry.favorite,
  };
}

/**
 * @function handleGenerateShortUrl
 * @description Handles the generation of a new shortened URL.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function handleGenerateShortURL(req, res) {
  // The Zod schema accepts either `redirectUrl` or `url` as an alias;
  // normalize here so the rest of the function only deals with one field.
  const {
    redirectUrl: redirectUrlField,
    url,
    title,
    customSlug,
    tag,
    tags,
    expiresAt,
    password,
    force,
  } = req.body;
  const redirectUrl = redirectUrlField || url;
  const hostBaseEarly = `${req.protocol}://${req.get("host")}`;

  // Duplicate detection: same user, same destination, not archived.
  // `force: true` from the client bypasses this (user chose "create anyway").
  if (!force && req.user?.id) {
    const existing = await Url.findDuplicate(req.user.id, redirectUrl);
    if (existing) {
      return res.status(200).json({
        duplicate: true,
        message: "You already have a link pointing to this URL.",
        link: serializeLink(existing, hostBaseEarly),
      });
    }
  }

  let parsedExpiresAt = null;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) {
      return res.status(400).json({ error: "Invalid expiration date" });
    }
    if (d <= new Date()) {
      return res
        .status(400)
        .json({ error: "Expiration date must be in the future" });
    }
    parsedExpiresAt = d;
  }

  let hashedPassword = null;
  if (password) {
    if (String(password).length < 4) {
      return res
        .status(400)
        .json({ error: "Password must be at least 4 characters" });
    }
    hashedPassword = await bcrypt.hash(String(password), BCRYPT_SALT_ROUNDS);
  }

  let shortId = shortid();
  if (customSlug) {
    const slug = String(customSlug).trim().toLowerCase();
    const existing = await Url.findOne({ shortId: slug });
    if (existing) {
      return res
        .status(409)
        .json({ error: "That slug is already taken. Try another." });
    }
    shortId = slug;
  } else {
    let retries = 0;
    const MAX_RETRIES = 5;
    let existing = await Url.findOne({ shortId });

    while (existing && retries < MAX_RETRIES) {
      shortId = shortid();
      existing = await Url.findOne({ shortId });
      retries++;
    }

    if (existing) {
      return res
        .status(500)
        .json({
          error:
            "Failed to generate a unique short URL. Please try again later.",
        });
    }
  }

  const allowedTags = ["active", "social", "campaign", "general"];
  const linkTag = allowedTags.includes(tag) ? tag : "active";

  let entry;
  try {
    entry = await Url.create({
      shortId,
      redirectUrl,
      userId: req.user?.id || null,
      title: await fetchWebsiteTitle(redirectUrl, title?.trim()),
      tag: linkTag,
      tags: sanitizeTags(tags),
      linkedAt: new Date(),
      expiresAt: parsedExpiresAt,
      password: hashedPassword,
    });
  } catch (err) {
    // TOCTOU: two concurrent requests can both pass the findOne() check
    // above before either create() resolves. The unique index on
    // shortId (see model/url.js) is the real guard against duplicates;
    // this catch turns the resulting MongoDB E11000 error into a clean
    // 409 instead of an unhandled 500.
    if (err && err.code === 11000) {
      return res
        .status(409)
        .json({ error: "That slug is already taken. Try another." });
    }
    throw err;
  }

  const hostBase = `${req.protocol}://${req.get("host")}`;

  return res.status(201).json({
    message: "Link created successfully",
    link: serializeLink(entry, hostBase),
  });
}

/**
 * @function handleListUserLinks
 * @description Retrieves and returns a list of URLs created by the authenticated user.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function handleListUserLinks(req, res) {
  const hostBase = `${req.protocol}://${req.get("host")}`;
  const userId = req.user?.id;
  const limit = parseListLimit(req.query?.limit);
  const cursor = req.query?.cursor || null;
  const includeArchived =
    req.query?.archived === "true" || req.query?.archived === "only";

  const entries = await Url.listForUser(userId, {
    limit: limit + 1,
    cursor,
    includeArchived,
  });
  const hasMore = entries.length > limit;
  let pageEntries = hasMore ? entries.slice(0, limit) : entries;

  if (req.query?.archived === "only") {
    pageEntries = pageEntries.filter((e) => e.archived);
  }
  if (req.query?.favorite === "true") {
    pageEntries = pageEntries.filter((e) => e.favorite);
  }

  const links = pageEntries.map((entry) => serializeLink(entry, hostBase));
  const userStats = await Url.getStatsForUser(userId);

  return res.json({
    links,
    stats: {
      totalLinks: userStats.totalLinks,
      totalClicks: userStats.totalClicks,
      totalClicksLabel: formatClicks(userStats.totalClicks),
      topLinkTitle:
        userStats.topLink?.title ||
        (userStats.topLink ? deriveTitle(userStats.topLink.redirectUrl) : "—"),
      topLinkClicks: formatClicks(userStats.topLink?.totalClicks || 0),
    },
    domain: hostBase.replace(/^https?:\/\//, ""),
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore
        ? pageEntries[pageEntries.length - 1]?._id?.toString?.() || null
        : null,
    },
  });
}

/**
 * Helper function to generate a Base64 Data URL for the QR code server-side.
 */
/**
 * @function generateBase64QR
 * @description Generates a base64 encoded QR code image for a given URL.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const generateBase64QR = async (text, fg, bg) => {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
    color: { dark: fg, light: bg },
  });
};

// ── Render Home Page (Dashboard) with Pagination ──────────────────────────────
const handleRenderDashboard = asyncHandler(async (req, res) => {
  // Implement cursor-based pagination for performance
  // Prevent loading entire collection into memory on large datasets
  const pageSize = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
  const cursor = req.query.cursor;

  if (cursor && !mongoose.Types.ObjectId.isValid(cursor)) {
    return res.status(400).render("home", {
      urls: [],
      nextCursor: null,
      hasMore: false,
      id: null,
      shortUrl: null,
      qrCode: null,
      campaignName: "",
      error: "Invalid pagination cursor",
    });
  }

  const userId = req.user?.id || null;
  const query = cursor ? { _id: { $lt: cursor }, userId } : { userId };
  const allUrls = await Url.find(query)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasNextPage = allUrls.length > pageSize;
  const urls = allUrls.slice(0, pageSize);
  const nextCursor = hasNextPage ? urls[urls.length - 1]?._id : null;

  return res.render("home", {
    urls: urls,
    nextCursor: nextCursor,
    hasMore: hasNextPage,
    id: null,
    shortUrl: null,
    qrCode: null,
    campaignName: "",
    error: null,
  });
});

// ── Shorten and Re-render Template ───────────────────────────────────────────
const handleGenerateShortUrlRender = asyncHandler(async (req, res) => {
  const { redirectUrl, url, campaignName, qrFgColor, qrBgColor } = req.body;
  const inputUrl = redirectUrl || url;

  if (!inputUrl || !isValidUrl(inputUrl)) {
    // Implement cursor-based pagination to avoid loading all records
    const pageSize = 20;
    const allUrls = await Url.find({ userId: req.user?.id || null })
      .sort({ _id: -1 })
      .limit(pageSize)
      .lean();

    return res.status(400).render("home", {
      urls: allUrls,
      error: "A valid HTTP or HTTPS URL is required",
      id: null,
      shortUrl: null,
      qrCode: null,
      campaignName: "",
    });
  }

  const shortId = nanoid(8);
  const baseUrl =
    process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  const shortUrl = `${baseUrl}/u/${shortId}`;

  const fgColor = qrFgColor || "#1a1a1a";
  const bgColor = qrBgColor || "#ffffff";

  // DB Record
  await Url.create({
    shortId,
    redirectUrl: inputUrl,
    campaignName: campaignName || "Untitled Campaign",
    qrFgColor: fgColor,
    qrBgColor: bgColor,
    qrGenerated: true,
    userId: req.user?.id || null,
    title: await fetchWebsiteTitle(inputUrl),
  });

  const qrCodeDataUrl = await generateBase64QR(shortUrl, fgColor, bgColor);
  // Implement cursor-based pagination to prevent full table scans
  const pageSize = 20;
  const allUrls = await Url.find({ userId: req.user?.id || null })
    .sort({ _id: -1 })
    .limit(pageSize)
    .lean();

  return res.render("home", {
    urls: allUrls,
    id: shortId,
    shortUrl: shortUrl,
    qrCode: qrCodeDataUrl,
    campaignName: campaignName || "Untitled Campaign",
    error: null,
  });
});

// ── Server-Generated SVG QR Code Route ───────────────────────────────────────
const handleGetQRCode = asyncHandler(async (req, res) => {
  const { shortId } = req.params;
  const entry = await Url.findOne({ shortId });

  if (!entry) {
    return res
      .status(404)
      .json({
        success: false,
        message: "Short URL not found",
        error: "Short URL not found",
      });
  }

  if (entry.userId?.toString() !== req.user?.id) {
    return res
      .status(403)
      .json({ success: false, message: "Not your URL", error: "Not your URL" });
  }

  const baseUrl =
    process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  const shortUrl = `${baseUrl}/u/${shortId}`;

  const svgString = await QRCode.toString(shortUrl, {
    type: "svg",
    color: {
      dark: entry.qrFgColor || "#1a1a1a",
      light: entry.qrBgColor || "#ffffff",
    },
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
  });

  Url.findOneAndUpdate({ shortId }, { $set: { qrGenerated: true } }).catch(
    (e) => console.error("[QR flag update error]", e),
  );

  res.set("Content-Type", "image/svg+xml");
  res.set("Cache-Control", "public, max-age=3600");
  return res.send(svgString);
});

// ── Server-Generated Download PNG Asset ──────────────────────────────────────
const handleDownloadQRCode = asyncHandler(async (req, res) => {
  const { shortId } = req.params;
  const entry = await Url.findOne({ shortId });

  if (!entry) {
    return res
      .status(404)
      .json({
        success: false,
        message: "Short URL not found",
        error: "Short URL not found",
      });
  }

  if (entry.userId?.toString() !== req.user?.id) {
    return res
      .status(403)
      .json({ success: false, message: "Not your URL", error: "Not your URL" });
  }

  const baseUrl =
    process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  const shortUrl = `${baseUrl}/u/${shortId}`;

  const pngBuffer = await QRCode.toBuffer(shortUrl, {
    type: "png",
    color: {
      dark: entry.qrFgColor || "#1a1a1a",
      light: entry.qrBgColor || "#ffffff",
    },
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });

  res.set("Content-Type", "image/png");
  res.set("Content-Disposition", `attachment; filename="qr-${shortId}.png"`);
  res.set("Cache-Control", "public, max-age=3600");
  return res.send(pngBuffer);
});

// ── Color API Endpoint Updater ────────────────────────────────────────────────
const handleUpdateQRColors = asyncHandler(async (req, res) => {
  const { shortId } = req.params;
  const { qrFgColor, qrBgColor } = req.body;

  const entry = await Url.findOne({ shortId });

  if (!entry) {
    return res
      .status(404)
      .json({
        success: false,
        message: "Short URL not found",
        error: "Short URL not found",
      });
  }

  if (entry.userId?.toString() !== req.user?.id) {
    return res
      .status(403)
      .json({ success: false, message: "Not your URL", error: "Not your URL" });
  }

  const updated = await Url.findOneAndUpdate(
    { shortId },
    {
      $set: {
        ...(qrFgColor && { qrFgColor }),
        ...(qrBgColor && { qrBgColor }),
      },
    },
    { new: true },
  );

  return res.json({
    success: true,
    message: "QR colors updated",
    qrFgColor: updated.qrFgColor,
    qrBgColor: updated.qrBgColor,
  });
});

// ── Get Click Metrics ────────────────────────────────────────────────────────
const handleGetAnalytics = asyncHandler(async (req, res) => {
  const { shortId } = req.params;
  const entry = await Url.findOne({ shortId });

  if (!entry) {
    return res
      .status(404)
      .json({
        success: false,
        message: "Short URL not found",
        error: "Short URL not found",
      });
  }

  if (entry.userId && entry.userId?.toString() !== req.user.id) {
    return res
      .status(403)
      .json({
        success: false,
        message: "Unauthorized to view these analytics",
        error: "Unauthorized to view these analytics",
      });
  }

  const qrClicks = entry.visitHistory
    ? entry.visitHistory.filter((v) => v.source === "qr").length
    : 0;
  const directClicks = entry.visitHistory
    ? entry.visitHistory.filter((v) => v.source === "direct").length
    : 0;

  return res.json({
    totalClicks: entry.totalClicks || 0,
    qrClicks,
    directClicks,
    qrGenerated: entry.qrGenerated || false,
    qrFgColor: entry.qrFgColor || "#1a1a1a",
    qrBgColor: entry.qrBgColor || "#ffffff",
    visitHistory: entry.visitHistory || [],
    createdAt: entry.createdAt,
  });
});

// ── Delete Short URL ──────────────────────────────────────────────────────────
const handleDeleteShortURL = asyncHandler(async (req, res) => {
  const { shortId } = req.params;
  const entry = await Url.findOne({ shortId });

  if (!entry) {
    return res
      .status(404)
      .json({
        success: false,
        message: "Short URL not found",
        error: "Short URL not found",
      });
  }

  if (entry.userId && entry.userId?.toString() !== req.user?.id) {
    return res
      .status(403)
      .json({
        success: false,
        message: "Unauthorized to delete this URL",
        error: "Unauthorized to delete this URL",
      });
  }

  if (Url.findByIdAndDelete) {
    await Url.findByIdAndDelete(entry._id || shortId);
  } else if (Url.deleteOne) {
    await Url.deleteOne({ shortId });
  }

  return res.json({
    success: true,
    message: "Short URL deleted successfully",
  });
});

// ── Edit an Existing Link ─────────────────────────────────────────────────
const handleUpdateShortURL = asyncHandler(async (req, res) => {
  const { shortId } = req.params;
  const { redirectUrl, title, tag, tags, expiresAt, password, removePassword } =
    req.body;

  const entry = await Url.findOne({ shortId });
  if (!entry) {
    return res
      .status(404)
      .json({ success: false, message: "Short URL not found" });
  }
  if (entry.userId && entry.userId.toString() !== req.user?.id) {
    return res.status(403).json({ success: false, message: "Not your URL" });
  }

  const updates = {};

  if (redirectUrl !== undefined) {
    if (!isValidUrl(redirectUrl)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid destination URL" });
    }
    updates.redirectUrl = redirectUrl;
  }
  if (title !== undefined) updates.title = String(title).trim().slice(0, 200);
  if (tag !== undefined) {
    const allowedTags = ["active", "social", "campaign", "general"];
    if (!allowedTags.includes(tag)) {
      return res.status(400).json({ success: false, message: "Invalid tag" });
    }
    updates.tag = tag;
  }
  if (tags !== undefined) updates.tags = sanitizeTags(tags);

  if (expiresAt !== undefined) {
    if (expiresAt === null || expiresAt === "") {
      updates.expiresAt = null;
    } else {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid expiration date" });
      }
      updates.expiresAt = d;
    }
  }

  if (removePassword) {
    updates.password = null;
  } else if (password) {
    if (String(password).length < 4) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must be at least 4 characters",
        });
    }
    updates.password = await bcrypt.hash(String(password), BCRYPT_SALT_ROUNDS);
  }

  const updated = await Url.findOneAndUpdate(
    { shortId },
    { $set: updates },
    { new: true },
  );
  const hostBase = `${req.protocol}://${req.get("host")}`;

  return res.json({ success: true, link: serializeLink(updated, hostBase) });
});

// ── Toggle Favorite ────────────────────────────────────────────────────────
const handleToggleFavorite = asyncHandler(async (req, res) => {
  const { shortId } = req.params;
  const entry = await Url.findOne({ shortId });
  if (!entry) {
    return res
      .status(404)
      .json({ success: false, message: "Short URL not found" });
  }
  if (entry.userId && entry.userId.toString() !== req.user?.id) {
    return res.status(403).json({ success: false, message: "Not your URL" });
  }
  const updated = await Url.findOneAndUpdate(
    { shortId },
    { $set: { favorite: !entry.favorite } },
    { new: true },
  );
  return res.json({ success: true, favorite: updated.favorite });
});

// ── Toggle Archive ─────────────────────────────────────────────────────────
const handleToggleArchive = asyncHandler(async (req, res) => {
  const { shortId } = req.params;
  const entry = await Url.findOne({ shortId });
  if (!entry) {
    return res
      .status(404)
      .json({ success: false, message: "Short URL not found" });
  }
  if (entry.userId && entry.userId.toString() !== req.user?.id) {
    return res.status(403).json({ success: false, message: "Not your URL" });
  }
  const updated = await Url.findOneAndUpdate(
    { shortId },
    { $set: { archived: !entry.archived } },
    { new: true },
  );
  return res.json({ success: true, archived: updated.archived });
});

// ── Bulk Import ────────────────────────────────────────────────────────────
// Accepts EITHER a raw-text body of newline-separated URLs (optionally
// "url,alias,tag" per line) OR an uploaded .csv file (same line format),
// mirroring the two input modes requested.
function parseBulkLines(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawUrl, rawSlug, rawTag] = line.split(",").map((p) => p?.trim());
      return {
        redirectUrl: rawUrl,
        customSlug: rawSlug || undefined,
        tag: rawTag || undefined,
      };
    });
}

const MAX_BULK_LINKS = 200;

const handleBulkImport = asyncHandler(async (req, res) => {
  const allowedTags = ["active", "social", "campaign", "general"];
  let rawText = req.body?.urls || "";

  if (req.file) {
    rawText += (rawText ? "\n" : "") + req.file.buffer.toString("utf-8");
  }

  if (!rawText.trim()) {
    return res
      .status(400)
      .json({
        success: false,
        message: "No URLs provided. Paste URLs or upload a .csv file.",
      });
  }

  const rows = parseBulkLines(rawText).slice(0, MAX_BULK_LINKS);
  const hostBase = `${req.protocol}://${req.get("host")}`;
  const created = [];
  const skipped = [];

  for (const row of rows) {
    if (!row.redirectUrl || !isValidUrl(row.redirectUrl)) {
      skipped.push({
        input: row.redirectUrl || "(empty)",
        reason: "Invalid URL",
      });
      continue;
    }

    let shortId = row.customSlug
      ? String(row.customSlug).trim().toLowerCase()
      : shortid();
    const existingSlug = await Url.findOne({ shortId });
    if (existingSlug) {
      if (row.customSlug) {
        skipped.push({
          input: row.redirectUrl,
          reason: `Slug "${shortId}" already taken`,
        });
        continue;
      }
      shortId = shortid();
    }

    const linkTag = allowedTags.includes(row.tag) ? row.tag : "active";

    try {
      const entry = await Url.create({
        shortId,
        redirectUrl: row.redirectUrl,
        userId: req.user?.id || null,
        title: await fetchWebsiteTitle(row.redirectUrl),
        tag: linkTag,
        linkedAt: new Date(),
      });
      created.push(serializeLink(entry, hostBase));
    } catch (err) {
      skipped.push({
        input: row.redirectUrl,
        reason: "Failed to create (possibly duplicate slug)",
      });
    }
  }

  return res.status(201).json({
    success: true,
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
  });
});

module.exports = {
  handleRenderDashboard,
  handleGenerateShortURL,
  handleGenerateShortUrlRender,
  handleGetQRCode,
  handleDownloadQRCode,
  handleUpdateQRColors,
  handleGetAnalytics,
  handleListUserLinks,
  handleDeleteShortURL,
  handleUpdateShortURL,
  handleToggleFavorite,
  handleToggleArchive,
  handleBulkImport,
};
