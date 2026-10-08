const { parseVisitMeta } = require("../../utils/deviceParser");

const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("parseVisitMeta", () => {
  it("detects a desktop browser", () => {
    const result = parseVisitMeta({ headers: { "user-agent": CHROME_DESKTOP } });
    expect(result.device).toBe("Desktop");
    expect(result.browser).toBe("Chrome");
  });

  it("detects a mobile device", () => {
    const result = parseVisitMeta({ headers: { "user-agent": IPHONE_SAFARI } });
    expect(result.device).toBe("Mobile");
  });

  it("falls back to Desktop and Unknown when there is no user-agent", () => {
    const result = parseVisitMeta({ headers: {} });
    expect(result.device).toBe("Desktop");
    expect(result.browser).toBe("Unknown");
  });

  it("uses the referer header, or Direct when missing", () => {
    expect(
      parseVisitMeta({ headers: { referer: "https://example.com" } }).referrer
    ).toBe("https://example.com");
    expect(parseVisitMeta({ headers: {} }).referrer).toBe("Direct");
  });

  it("reads the country from Vercel or Cloudflare headers", () => {
    expect(
      parseVisitMeta({ headers: { "x-vercel-ip-country": "IN" } }).country
    ).toBe("IN");
    expect(
      parseVisitMeta({ headers: { "cf-ipcountry": "US" } }).country
    ).toBe("US");
    expect(parseVisitMeta({ headers: {} }).country).toBe("Unknown");
  });
});