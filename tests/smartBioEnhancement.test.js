const {
  PRESET_PALETTES,
  generateCssVariables,
  isValidLeadEmail,
  computeBioCtr,
} = require("../services/smartBioEnhancementService");

describe("Smart Bio Theme & Lead Capture Engine Unit Tests", () => {
  describe("generateCssVariables", () => {
    it("should generate clean CSS custom properties from preset theme", () => {
      const css = generateCssVariables("midnight_neon");
      expect(css).toContain(":root {");
      expect(css).toContain("--bio-bg-1: #0F172A");
      expect(css).toContain("--bio-text-color: #F8FAFC");
      expect(css).toContain("--bio-accent-color: #38BDF8");
      expect(css).toContain("--bio-font-family: 'Outfit'");
    });

    it("should sanitize invalid hex codes to prevent CSS injection", () => {
      const maliciousStyles = {
        bgColor1: "red; } body { display:none; } /*",
        accentColor: "#00FF00",
      };

      const css = generateCssVariables("midnight_neon", maliciousStyles);
      // Malicious style was rejected and replaced with fallback
      expect(css).not.toContain("body { display:none; }");
      expect(css).toContain("--bio-bg-1: #0F172A");
      expect(css).toContain("--bio-accent-color: #00FF00");
    });
  });

  describe("isValidLeadEmail", () => {
    it("should accept valid standard email formats", () => {
      expect(isValidLeadEmail("fan@creator.com")).toBe(true);
      expect(isValidLeadEmail("alex.smith+test@domain.co.uk")).toBe(true);
    });

    it("should reject malformed or empty email addresses", () => {
      expect(isValidLeadEmail("invalid-email")).toBe(false);
      expect(isValidLeadEmail("@missinguser.com")).toBe(false);
      expect(isValidLeadEmail("")).toBe(false);
      expect(isValidLeadEmail(null)).toBe(false);
    });
  });

  describe("computeBioCtr", () => {
    it("should compute click-through rate percentage accurately", () => {
      expect(computeBioCtr(1000, 150)).toBe(15.0);
      expect(computeBioCtr(250, 25)).toBe(10.0);
      expect(computeBioCtr(0, 5)).toBe(0);
    });
  });
});
