const { canTransitionStage, generateRepurposedTree } = require("../services/contentWorkflowService");
const ContentRepurposeWorkflow = require("../model/contentRepurposeWorkflow");
const mongoose = require("mongoose");

describe("Content Repurposing & Approval Workflow Unit Tests", () => {
  describe("canTransitionStage", () => {
    it("should prevent transitioning to approved if checklist is incomplete", () => {
      const result = canTransitionStage("final_review", "approved", false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("editorial checklist");
    });

    it("should allow transitioning to approved when checklist is complete", () => {
      const result = canTransitionStage("final_review", "approved", true);
      expect(result.allowed).toBe(true);
    });

    it("should allow transitioning backwards to earlier revision stages", () => {
      const result = canTransitionStage("final_review", "rough_cut", false);
      expect(result.allowed).toBe(true);
    });

    it("should reject skipping more than 2 stages forward", () => {
      const result = canTransitionStage("concept_pitch", "final_review", false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("skip intermediate");
    });
  });

  describe("generateRepurposedTree", () => {
    it("should generate standard 6-derivative multi-platform child assets", () => {
      const tree = generateRepurposedTree("How I Automated My Production");
      expect(tree).toHaveLength(6);

      const platforms = tree.map((t) => t.targetPlatform);
      expect(platforms).toContain("youtube_shorts");
      expect(platforms).toContain("instagram_reels");
      expect(platforms).toContain("tiktok");
      expect(platforms).toContain("twitter_thread");
      expect(platforms).toContain("linkedin_carousel");
      expect(platforms).toContain("newsletter");

      tree.forEach((child) => {
        expect(child.title).toContain("How I Automated My Production");
        expect(child.status).toBe("pending");
      });
    });
  });

  describe("ContentRepurposeWorkflow Schema Method", () => {
    it("should verify complete checklist only when all 4 conditions are true", () => {
      const item = new ContentRepurposeWorkflow({
        creatorId: new mongoose.Types.ObjectId(),
        title: "Test Video",
      });

      expect(item.isChecklistComplete()).toBe(false);

      item.editorialChecklist.audioNormalized = true;
      item.editorialChecklist.thumbnailApproved = true;
      item.editorialChecklist.sponsorCleared = true;
      expect(item.isChecklistComplete()).toBe(false);

      item.editorialChecklist.closedCaptionsSynced = true;
      expect(item.isChecklistComplete()).toBe(true);
    });
  });
});
