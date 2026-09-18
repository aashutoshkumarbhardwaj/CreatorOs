const mongoose = require("mongoose");
const DmConsent = require("../../model/dmConsent");
const dmConsentService = require("../../services/dmConsentService");

describe("dmConsentService", () => {
  const testCreatorId = new mongoose.Types.ObjectId();
  const testRecipientId = "17841400000000001";

  beforeEach(async () => {
    await DmConsent.deleteMany({});
  });

  describe("Keyword Detection", () => {
    describe("isOptOutKeyword", () => {
      it("recognizes standard opt-out keywords case-insensitively", () => {
        expect(dmConsentService.isOptOutKeyword("STOP")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("stop")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("Stop")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("UNSUBSCRIBE")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("unsubscribe")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("CANCEL")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("QUIT")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("END")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("OPTOUT")).toBe(true);
      });

      it("handles whitespace and trailing punctuation gracefully", () => {
        expect(dmConsentService.isOptOutKeyword("  STOP  ")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("STOP!")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("stop.")).toBe(true);
        expect(dmConsentService.isOptOutKeyword("UNSUBSCRIBE!!")).toBe(true);
      });

      it("rejects non-opt-out text and substrings", () => {
        expect(dmConsentService.isOptOutKeyword("stopper")).toBe(false);
        expect(dmConsentService.isOptOutKeyword("please stop by my profile")).toBe(false);
        expect(dmConsentService.isOptOutKeyword("never stop learning")).toBe(false);
        expect(dmConsentService.isOptOutKeyword("GUIDE")).toBe(false);
        expect(dmConsentService.isOptOutKeyword("")).toBe(false);
        expect(dmConsentService.isOptOutKeyword(null)).toBe(false);
        expect(dmConsentService.isOptOutKeyword(undefined)).toBe(false);
        expect(dmConsentService.isOptOutKeyword(123)).toBe(false);
      });
    });

    describe("isOptInKeyword", () => {
      it("recognizes standard opt-in keywords case-insensitively", () => {
        expect(dmConsentService.isOptInKeyword("START")).toBe(true);
        expect(dmConsentService.isOptInKeyword("start")).toBe(true);
        expect(dmConsentService.isOptInKeyword("YES")).toBe(true);
        expect(dmConsentService.isOptInKeyword("yes")).toBe(true);
        expect(dmConsentService.isOptInKeyword("UNSTOP")).toBe(true);
        expect(dmConsentService.isOptInKeyword("unstop")).toBe(true);
      });

      it("handles whitespace and trailing punctuation for opt-in keywords", () => {
        expect(dmConsentService.isOptInKeyword("  START  ")).toBe(true);
        expect(dmConsentService.isOptInKeyword("YES!")).toBe(true);
        expect(dmConsentService.isOptInKeyword("unstop.")).toBe(true);
      });

      it("rejects non-opt-in text and substrings", () => {
        expect(dmConsentService.isOptInKeyword("startup")).toBe(false);
        expect(dmConsentService.isOptInKeyword("yesterday")).toBe(false);
        expect(dmConsentService.isOptInKeyword("yes please")).toBe(false);
        expect(dmConsentService.isOptInKeyword("")).toBe(false);
        expect(dmConsentService.isOptInKeyword(null)).toBe(false);
      });
    });
  });

  describe("Consent Persistence", () => {
    it("recordOptOut creates a new opted_out document with history and timestamps", async () => {
      const result = await dmConsentService.recordOptOut({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
        keyword: "STOP!",
      });

      expect(result).toBeDefined();
      expect(result.creatorId.toString()).toBe(testCreatorId.toString());
      expect(result.platform).toBe("instagram");
      expect(result.recipientId).toBe(testRecipientId);
      expect(result.status).toBe("opted_out");
      expect(result.optedOutAt).toBeInstanceOf(Date);
      expect(result.lastOptOutKeyword).toBe("STOP!");
      expect(result.history).toHaveLength(1);
      expect(result.history[0].action).toBe("opt_out");
      expect(result.history[0].keyword).toBe("STOP!");
    });

    it("recordOptOut is safe and idempotent across multiple calls", async () => {
      await dmConsentService.recordOptOut({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
        keyword: "STOP",
      });

      const secondResult = await dmConsentService.recordOptOut({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
        keyword: "UNSUBSCRIBE",
      });

      expect(secondResult.status).toBe("opted_out");
      expect(secondResult.lastOptOutKeyword).toBe("UNSUBSCRIBE");
      expect(secondResult.history).toHaveLength(2);

      const totalCount = await DmConsent.countDocuments({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
      });
      expect(totalCount).toBe(1);
    });

    it("recordOptIn restores opted_in status and clears optedOutAt", async () => {
      await dmConsentService.recordOptOut({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
        keyword: "STOP",
      });

      const optedInResult = await dmConsentService.recordOptIn({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
        keyword: "START",
      });

      expect(optedInResult.status).toBe("opted_in");
      expect(optedInResult.optedOutAt).toBeNull();
      expect(optedInResult.optedInAt).toBeInstanceOf(Date);
      expect(optedInResult.history).toHaveLength(2);
      expect(optedInResult.history[1].action).toBe("opt_in");
      expect(optedInResult.history[1].keyword).toBe("START");
    });

    it("throws an error when required creatorId or recipientId is missing", async () => {
      await expect(
        dmConsentService.recordOptOut({ recipientId: testRecipientId })
      ).rejects.toThrow("creatorId and recipientId are required to record opt-out");

      await expect(
        dmConsentService.recordOptIn({ creatorId: testCreatorId })
      ).rejects.toThrow("creatorId and recipientId are required to record opt-in");
    });
  });

  describe("canSend Pre-Send Check", () => {
    it("returns true when no consent record exists for recipient", async () => {
      const allowed = await dmConsentService.canSend({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: "unknown_user_999",
      });
      expect(allowed).toBe(true);
    });

    it("returns true when recipient has status opted_in", async () => {
      await dmConsentService.recordOptIn({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
        keyword: "START",
      });

      const allowed = await dmConsentService.canSend({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
      });
      expect(allowed).toBe(true);
    });

    it("returns false when recipient has status opted_out", async () => {
      await dmConsentService.recordOptOut({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
        keyword: "STOP",
      });

      const allowed = await dmConsentService.canSend({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
      });
      expect(allowed).toBe(false);
    });

    it("fails closed by propagating database errors", async () => {
      const dbError = new Error("Connection timed out");
      jest.spyOn(DmConsent, "findOne").mockRejectedValueOnce(dbError);

      await expect(
        dmConsentService.canSend({
          creatorId: testCreatorId,
          platform: "instagram",
          recipientId: testRecipientId,
        })
      ).rejects.toThrow("Connection timed out");
    });
  });

  describe("getConsentStatus", () => {
    it("returns opted_in for missing records", async () => {
      const status = await dmConsentService.getConsentStatus({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: "unseen_recipient",
      });
      expect(status).toBe("opted_in");
    });

    it("returns opted_out for suppressed records", async () => {
      await dmConsentService.recordOptOut({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
        keyword: "STOP",
      });

      const status = await dmConsentService.getConsentStatus({
        creatorId: testCreatorId,
        platform: "instagram",
        recipientId: testRecipientId,
      });
      expect(status).toBe("opted_out");
    });
  });
});
