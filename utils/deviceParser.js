const { UAParser } = require("ua-parser-js");

function parseVisitMeta(req) {
  const ua = req.headers["user-agent"] || "";
  const parser = new UAParser(ua);
  const result = parser.getResult();

  const device = result.device.type
    ? result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1)
    : "Desktop";
  const browser = result.browser.name || "Unknown";

  const referrer =
    req.headers["referer"] || req.headers["referrer"] || "Direct";

  // Works out-of-the-box on Vercel; falls back gracefully elsewhere.
  const country =
    req.headers["x-vercel-ip-country"] ||
    req.headers["cf-ipcountry"] ||
    "Unknown";

  return { device, browser, referrer, country };
}

module.exports = { parseVisitMeta };
