// Regression guard for issue #489: a duplicate `const protect = require(...)`
// declaration in routes/instagram.js previously caused a hard parse-time
// crash (`SyntaxError: Identifier 'protect' has already been declared`)
// that took down the entire server, since index.js requires this file at
// module load time. That specific duplicate isn't present in this file as
// of this commit, but nothing prevented it from being reintroduced silently
// in a future edit — a syntax error in a route file is invisible until the
// server actually restarts in production.
//
// This test requires every file in routes/ and just asserts it doesn't
// throw. It won't catch runtime logic bugs, but it WILL catch:
//   - duplicate top-level const/let declarations
//   - other syntax errors
//   - missing/renamed imports that break at require-time
//
// If this test ever fails, do NOT silence it — it means a route file
// cannot be loaded and would crash the real server the same way #489 did.

const fs = require("fs");
const path = require("path");

const ROUTES_DIR = path.join(__dirname, "..", "routes");

describe("route files load without error", () => {
  const routeFiles = fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith(".js"));

  test("routes directory is not empty (sanity check for this test itself)", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  routeFiles.forEach((file) => {
    test(`routes/${file} requires without throwing`, () => {
      const fullPath = path.join(ROUTES_DIR, file);
      expect(() => {
        // Clear the cache so re-running tests / watch mode re-evaluates
        // the file fresh each time, rather than reusing a cached module.
        delete require.cache[require.resolve(fullPath)];
        require(fullPath);
      }).not.toThrow();
    });
  });
});