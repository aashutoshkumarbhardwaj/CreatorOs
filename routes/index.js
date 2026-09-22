const express = require("express");
const router = express.Router();
const path = require("path");

const { BRAND } = require("../utils/brand");

// Middlewares needed for specific routes
const {
  protect,
  preventContributorWrites,
} = require("../middleware/auth");

const { generalLimiter } = require("../middleware/rateLimiters");

// Domain routers
const urlRoutes = require("./url");
const analyticsRoutes = require("./analytics");
const collaborationRoutes = require("./collaboration");
const aiRoute = require("./ai");
const authRoutes = require("./auth");
const instagramRoutes = require("./instagram");
const billingRoute = require("./billing");
const domainRoute = require("./domain");
const sponsorRoute = require("./sponsor");
const settingsRoutes = require("./settings");
const contentRoutes = require("./content");
const suggestionRoutes = require("./suggestionRoutes");
const bioRoutes = require("./bioRoutes");
const qrCodeRoutes = require("./qrCode");
const smartNotificationRoutes = require("./smartNotificationRoutes");
const contentOsRoutes = require("./contentOsRoutes");
const creatorCrmRoutes = require("./creatorCrmRoutes");
const taskRoutes = require("./taskRoutes");
const aiAssistantRoutes = require("./aiAssistantRoutes");
const meetingRoutes = require("./meetingRoutes");
const sponsorshipCalculatorRoutes = require("./sponsorshipCalculator");
const fileUploadRoutes = require("./fileUpload");

// Extracted routers
const redirectRoutes = require("./redirectRoutes");
const viewRoutes = require("./viewRoutes");

const {
  acceptInvite,
  acceptInviteFromDashboard,
} = require("../controller/collaborationController");
const { renderCalendarPage } = require("../controller/contentOsController");
const { renderPublicBioProfile } = require("../controller/bioController");

// Mount Auth routes (not under /api)
router.use("/", authRoutes);

// Services and Features
router.use("/suggestions", protect, suggestionRoutes);
router.use("/services/creator-crm", protect, collaborationRoutes);
router.use("/services/qr-code-generator", qrCodeRoutes);
router.use("/services/content-os", protect, contentOsRoutes);
router.use("/services/ai-assistant", aiAssistantRoutes);
router.get("/services/content-calendar", protect, renderCalendarPage);

// Smart Notifications, Tasks, Meetings
router.use("/", smartNotificationRoutes);
router.use("/", taskRoutes);
router.use("/", meetingRoutes);

// File uploads
router.use("/services/file-upload", protect, preventContributorWrites, fileUploadRoutes);

// Invites
router.post(
  "/dashboard/accept-invite",
  protect,
  preventContributorWrites,
  acceptInviteFromDashboard
);
router.get("/invites/accept/:token", acceptInvite);

// API Routes
router.use("/api", generalLimiter);
router.use("/api/billing", billingRoute);
router.use("/api/domain", domainRoute);
router.use("/api/sponsors", sponsorRoute);
router.use("/api/crm", creatorCrmRoutes);
router.use("/api/settings", protect, settingsRoutes);
router.use("/api/content", protect, contentRoutes);
router.use("/api/urls", protect, urlRoutes);
router.use("/api/ai", aiRoute);
router.use("/api/analytics", protect, analyticsRoutes);
router.use("/api/instagram", instagramRoutes);
router.use("/api/sponsorship", protect, sponsorshipCalculatorRoutes);

// Swagger Documentation
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../utils/swaggerOptions");

router.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCssUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.min.css",
  })
);

// Short URL and QR Redirection
router.use("/", redirectRoutes);

// View routes (pages)
router.use("/", viewRoutes);

// Sitemap
router.get("/sitemap.xml", (req, res) => {
  const baseUrl = BRAND.siteUrl;

  const urls = [
    "/",
    "/login",
    "/signup",
    "/services",
    "/dashboard",
    "/profile",
    "/analytics",
    "/vault",
    "/bio",
    "/settings",
    "/suggestions",
    "/my-links",
    "/dm-automation",
    "/services/creator-crm",
    "/services/sponsorship-calculator",
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `
    <url>
        <loc>${baseUrl}${url}</loc>
        <changefreq>weekly</changefreq>
        <priority>${url === "/" ? "1.0" : "0.7"}</priority>
    </url>
`
  )
  .join("")}
</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// Dynamic fallback profile route (e.g. creatoros.com/alex)
router.get("/:handle", renderPublicBioProfile);

module.exports = router;
