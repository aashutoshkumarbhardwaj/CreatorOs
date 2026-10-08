const {
  PLATFORM_LIMITS,
  generateViralHooks,
  generateVideoScriptOutline,
  adaptToPlatforms,
  analyzeHashtags,
} = require("../services/aiContentStudioService");

describe("AI Content Studio & Ideation Tools Unit Tests", () => {
  describe("generateViralHooks", () => {
    it("should generate 5 distinct hook frameworks containing the topic", () => {
      const hooks = generateViralHooks("Newsletter Monetization", "Creator Business");
      expect(hooks).toHaveLength(5);

      const styles = hooks.map((h) => h.style);
      expect(styles).toContain("Curiosity Gap");
      expect(styles).toContain("Contrarian / Hot Take");
      expect(styles).toContain("Negative Consequence / Urgency");
      expect(styles).toContain("Statistical / Authority");
      expect(styles).toContain("Storytelling / Transformation");

      hooks.forEach((h) => {
        expect(h.text).toContain("Newsletter Monetization");
      });
    });
  });

  describe("generateVideoScriptOutline", () => {
    it("should produce a structured 5-part script architecture", () => {
      const script = generateVideoScriptOutline("Thumbnail Design");
      expect(script).toHaveProperty("hook");
      expect(script).toHaveProperty("retentionBuffer");
      expect(script).toHaveProperty("mainPoints");
      expect(script).toHaveProperty("climax");
      expect(script).toHaveProperty("callToAction");

      expect(script.mainPoints.length).toBe(3);
      expect(script.hook).toContain("Thumbnail Design");
    });
  });

  describe("adaptToPlatforms", () => {
    it("should format content within platform character limitations", () => {
      const topic = "Time Management";
      const message =
        "Time blocking your calendar every Sunday evening will eliminate daily decision fatigue and 10x your output.";
      const platforms = ["twitter", "instagram", "linkedin"];

      const adapted = adaptToPlatforms(topic, message, platforms);
      expect(adapted).toHaveLength(3);

      adapted.forEach((item) => {
        const limit = PLATFORM_LIMITS[item.platform];
        expect(item.characterCount).toBeLessThanOrEqual(limit);
        expect(item.hashtags.length).toBeGreaterThan(0);
        expect(item.callToAction).toBeDefined();
      });

      const twitterVariant = adapted.find((a) => a.platform === "twitter");
      expect(twitterVariant.caption.length).toBeLessThanOrEqual(280);
    });
  });

  describe("analyzeHashtags", () => {
    it("should categorize hashtags into reach tiers", () => {
      const tags = analyzeHashtags("fitness");
      expect(tags.length).toBeGreaterThanOrEqual(4);

      const tiers = tags.map((t) => t.tier);
      expect(tiers).toContain("high");
      expect(tiers).toContain("medium");
      expect(tiers).toContain("niche");
    });
  });
});
