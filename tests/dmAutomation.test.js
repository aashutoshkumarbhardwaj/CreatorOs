const {
  matchesTrigger,
  renderReplyTemplate,
  isUserInCooldown,
  setUserCooldown,
} = require("../services/dmAutomationEngine");
const DmAutomationRule = require("../model/dmAutomationRule");
const mongoose = require("mongoose");

describe("DM Automation Engine Unit Tests", () => {
  describe("Keyword Trigger Matching", () => {
    it("should match contains keywords case-insensitively", () => {
      const rule = {
        matchType: "contains",
        triggerKeywords: ["pricing", "rate card", "rates"],
      };

      expect(matchesTrigger("Hey what is your PRICING for reels?", rule)).toBe(true);
      expect(matchesTrigger("Can you send your rate card please?", rule)).toBe(true);
      expect(matchesTrigger("Love your recent post!", rule)).toBe(false);
    });

    it("should match exact keywords strictly", () => {
      const rule = {
        matchType: "exact",
        triggerKeywords: ["link", "guide"],
      };

      expect(matchesTrigger("LINK", rule)).toBe(true);
      expect(matchesTrigger("guide", rule)).toBe(true);
      expect(matchesTrigger("Send me the link please", rule)).toBe(false);
    });

    it("should handle regex patterns safely without throwing on malformed input", () => {
      const rule = {
        matchType: "regex",
        triggerKeywords: ["^ebook\\s*\\d+$", "[invalid(regex"],
      };

      expect(matchesTrigger("ebook 101", rule)).toBe(true);
      expect(matchesTrigger("ebook  2026", rule)).toBe(true);
      expect(matchesTrigger("random string", rule)).toBe(false);
    });
  });

  describe("Template Substitution & Cooldown", () => {
    it("should replace senderName and creatorName placeholders", () => {
      const template = "Hey {{senderName}}, thanks for reaching out! - {{creatorName}}";
      const result = renderReplyTemplate(template, "Sarah", "TechVlogger");
      expect(result).toBe("Hey Sarah, thanks for reaching out! - TechVlogger");
    });

    it("should enforce user cooldown window", () => {
      const ruleId = new mongoose.Types.ObjectId().toString();
      const senderId = "user_insta_9988";

      expect(isUserInCooldown(ruleId, senderId, 60)).toBe(false);

      setUserCooldown(ruleId, senderId);
      expect(isUserInCooldown(ruleId, senderId, 60)).toBe(true);
      expect(isUserInCooldown(ruleId, senderId, 0)).toBe(false); // 0 minutes expired immediately
    });
  });

  describe("Daily Send Limit Logic", () => {
    it("should track daily sends and reset on new day", () => {
      const rule = new DmAutomationRule({
        creatorId: new mongoose.Types.ObjectId(),
        name: "Test Rule",
        triggerKeywords: ["test"],
        responseTemplate: "Hi",
        dailySendLimit: 2,
      });

      expect(rule.canSendToday()).toBe(true);
      rule.recordSend();
      expect(rule.canSendToday()).toBe(true);
      rule.recordSend();
      expect(rule.canSendToday()).toBe(false); // limit 2 reached
    });
  });
});
