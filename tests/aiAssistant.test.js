const request = require("supertest");
const express = require("express");
const {
  sanitizePrompt,
  extractKeywords,
  generateHashtagMatrix,
  analyzeContentSeo,
  predictContentPerformance,
  generateConversationalResponse,
  generateCreatorInsights,
} = require("../services/aiAssistantService");

describe("AI Creator Assistant Service Unit Tests", () => {
  test("sanitizePrompt should strip sensitive API keys, tokens, emails, and credit cards", () => {
    const raw = "My key is sk-1234567890abcdef1234567890abcdef and email user@example.com with Bearer token_secret_12345";
    const sanitized = sanitizePrompt(raw);
    expect(sanitized).not.toContain("sk-1234567890abcdef1234567890abcdef");
    expect(sanitized).not.toContain("user@example.com");
    expect(sanitized).not.toContain("Bearer token_secret_12345");
    expect(sanitized).toContain("[REDACTED_API_KEY]");
    expect(sanitized).toContain("[REDACTED_EMAIL]");
    expect(sanitized).toContain("[REDACTED_TOKEN]");
  });

  test("extractKeywords should extract relevant non-stopwords", () => {
    const text = "Discover how to double your Instagram content engagement and audience growth strategies";
    const keywords = extractKeywords(text, 4);
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords).toContain("instagram");
    expect(keywords).not.toContain("the");
    expect(keywords).not.toContain("and");
  });

  test("generateHashtagMatrix should categorize hashtags into viral, niche, and micro", () => {
    const topic = "YouTube Shorts editing secrets";
    const matrix = generateHashtagMatrix(topic, "youtube");
    expect(matrix).toHaveProperty("viral");
    expect(matrix).toHaveProperty("niche");
    expect(matrix).toHaveProperty("micro");
    expect(Array.isArray(matrix.viral)).toBe(true);
    expect(matrix.viral[0]).toContain("#");
  });

  test("analyzeContentSeo should compute real-time SEO discoverability score and recommendations", () => {
    const text = "5 proven secrets to boost your YouTube video click-through rate and subscriber growth!";
    const seo = analyzeContentSeo(text, "youtube");
    expect(seo).toHaveProperty("seoScore");
    expect(typeof seo.seoScore).toBe("number");
    expect(seo.seoScore).toBeGreaterThanOrEqual(0);
    expect(seo.seoScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(seo.titleSuggestions)).toBe(true);
    expect(seo.titleSuggestions.length).toBeGreaterThan(0);
  });

  test("predictContentPerformance should output virality score, readability grade, and optimal posting window", () => {
    const text = "Stop making this huge mistake when launching your digital products online!";
    const prediction = predictContentPerformance(text, "instagram");
    expect(prediction).toHaveProperty("viralityScore");
    expect(prediction).toHaveProperty("readabilityGrade");
    expect(prediction).toHaveProperty("recommendedPostingTime");
    expect(typeof prediction.viralityScore).toBe("number");
  });

  test("generateConversationalResponse should return structured assistant payload", async () => {
    const result = await generateConversationalResponse({
      prompt: "Give me 3 video hooks for tech review",
      platform: "youtube",
      tone: "energetic",
    });
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("seoScore");
    expect(result).toHaveProperty("viralityScore");
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(10);
  });

  test("generateCreatorInsights should yield 3 category growth insights", () => {
    const insights = generateCreatorInsights({ niche: "Tech Creator" });
    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBe(3);
    expect(insights[0]).toHaveProperty("category");
    expect(insights[0]).toHaveProperty("tip");
    expect(insights[0]).toHaveProperty("impactScore");
  });
});
