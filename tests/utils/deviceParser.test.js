const { parseVisitMeta } = require("../../utils/deviceParser");

function reqWith(headers) {
  return { headers };
}

describe("parseVisitMeta", () => {
  it("defaults to desktop and unknown when headers are empty", () => {
    const out = parseVisitMeta(reqWith({}));
    expect(out.device).toBe("Desktop");
    expect(out.browser).toBe("Unknown");
    expect(out.referrer).toBe("Direct");
    expect(out.country).toBe("Unknown");
  });

  it("picks up mobile device and browser from user agent", () => {
    const out = parseVisitMeta(
      reqWith({
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      })
    );
    expect(out.device).toBe("Mobile");
    expect(out.browser).toBe("Mobile Safari");
  });

  it("reads chrome on desktop", () => {
    const out = parseVisitMeta(
      reqWith({
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      })
    );
    expect(out.device).toBe("Desktop");
    expect(out.browser).toBe("Chrome");
  });

  it("uses referer header when present", () => {
    const out = parseVisitMeta(reqWith({ referer: "https://google.com" }));
    expect(out.referrer).toBe("https://google.com");
  });

  it("falls back to referrer spelling", () => {
    const out = parseVisitMeta(reqWith({ referrer: "https://x.com/post" }));
    expect(out.referrer).toBe("https://x.com/post");
  });

  it("prefers vercel country header", () => {
    const out = parseVisitMeta(
      reqWith({ "x-vercel-ip-country": "IN", "cf-ipcountry": "US" })
    );
    expect(out.country).toBe("IN");
  });

  it("uses cloudflare country when vercel missing", () => {
    const out = parseVisitMeta(reqWith({ "cf-ipcountry": "US" }));
    expect(out.country).toBe("US");
  });
});
