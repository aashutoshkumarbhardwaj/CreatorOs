/**
 * Regression test for BUG-006: Bio Route Collision with URL Shortener (/u/:shortId)
 *
 * Verifies that:
 * 1. bioRoutes no longer registers /u/:handle, eliminating route collisions with /u/:shortId.
 * 2. Bio profiles remain accessible via /@:handle, /bio/:handle, and /b/:handle.
 * 3. Short URLs under /u/:shortId reliably reach the short URL handler, even if a bio profile
 *    shares the exact same handle as the short URL slug.
 */
const express = require("express");
const request = require("supertest");

describe("BUG-006 Regression: Bio Profile & URL Shortener Route Isolation", () => {
  let app;
  const sharedSlug = "promolink";

  beforeAll(() => {
    app = express();

    // Load actual bio router
    const bioRoutes = require("../../routes/bioRoutes");

    // Mount bioRoutes at root (identical to index.js:776)
    app.use("/", bioRoutes);

    // Mock URL shortener redirect handler (identical to index.js:930)
    app.get("/u/:shortId", (req, res) => {
      res.status(302).setHeader("Location", `https://example.com/dest/${req.params.shortId}`).end();
    });
  });

  it("does not intercept /u/:slug with bio router and allows URL shortener to redirect", async () => {
    const res = await request(app).get(`/u/${sharedSlug}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`https://example.com/dest/${sharedSlug}`);
  });

  it("bio profile routes are declared for @handle, /bio/:handle, and /b/:handle", () => {
    const bioRoutes = require("../../routes/bioRoutes");
    const registeredRoutes = bioRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    expect(registeredRoutes).toContain("/@:handle");
    expect(registeredRoutes).toContain("/bio/:handle");
    expect(registeredRoutes).toContain("/b/:handle");
    // Crucial check: /u/:handle must NOT be present
    expect(registeredRoutes).not.toContain("/u/:handle");
  });
});
