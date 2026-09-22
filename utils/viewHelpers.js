const services = require("../services.config");

function findServiceByKey(key) {
  return services.find((service) => service.key === key);
}

function buildAccountViewModel(userDoc, fallbackUser) {
  const name = userDoc?.name || fallbackUser?.name || "Creator";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "CR";

  const passwordChangedAt =
    userDoc?.passwordChangedAt || userDoc?.updatedAt || null;
  let passwordAgeDays = null;
  if (passwordChangedAt) {
    passwordAgeDays = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(passwordChangedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
  }

  const sub = userDoc?.subscription || {};
  const nextInvoice = sub.nextInvoiceDate ? new Date(sub.nextInvoiceDate) : null;

  return {
    id: fallbackUser.id,
    name,
    email: userDoc?.email || fallbackUser?.email || "",
    alias: userDoc?.alias || "",
    bio: userDoc?.bio || "",
    twoFactorEnabled: userDoc?.twoFactorEnabled || false,
    preferences: userDoc?.preferences || {
      appearanceMode: "light",
      interfaceDensity: "tactile",
      motionEffects: true,
      soundCues: false,
      autoSaveLinks: true,
    },
    passwordAgeDays,
    billing: {
      status: sub.status || "free",
      planName: sub.planName || "Free",
      priceMonthly: sub.priceMonthly ?? 0,
      nextInvoiceLabel: nextInvoice
        ? nextInvoice.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "No upcoming invoice",
      estimatedTotal: sub.priceMonthly
        ? `$${sub.priceMonthly.toFixed(2)} USD`
        : "$0.00 USD",
      cardBrand: sub.cardBrand || null,
      cardLast4: sub.cardLast4 || null,
      invoices: sub.invoices || [],
    },
    initials,
    scheduledDeletionAt: userDoc?.scheduledDeletionAt || null,
    deletionConfirmed: userDoc?.deletionConfirmed || false,
  };
}

function buildShortenerViewModel(req, shortId = null, error = null) {
  return {
    service: findServiceByKey("url-shortener"),
    services,
    shortUrl: shortId ? `${req.protocol}://${req.get("host")}/u/${shortId}` : null,
    error,
    user: buildAccountViewModel(null, req.user),
  };
}

async function buildAnalyticsViewModel(userId, shortLinkId = null, range = "30", creatorId = null) {
  const { buildUnifiedAnalyticsData } = require("./analyticsHelper");
  return await buildUnifiedAnalyticsData(userId, { shortLinkId, range, creatorId });
}

function isGuestContributor(user) {
  return user?.role === "guest_contributor";
}

function buildEmptyInviteSummary() {
  return { total: 0, pending: 0, accepted: 0, expired: 0 };
}

module.exports = {
  findServiceByKey,
  buildAccountViewModel,
  buildShortenerViewModel,
  buildAnalyticsViewModel,
  isGuestContributor,
  buildEmptyInviteSummary,
};
