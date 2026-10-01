/**
 * Content Repurposing & Editorial Workflow Service
 */

const STAGE_ORDER = ["concept_pitch", "script_draft", "rough_cut", "final_review", "approved", "published"];

/**
 * Validate stage transition rules
 */
function canTransitionStage(currentStage, nextStage, checklistComplete) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const nextIndex = STAGE_ORDER.indexOf(nextStage);

  if (currentIndex === -1 || nextIndex === -1) {
    return { allowed: false, reason: "Invalid stage specified" };
  }

  // Jumping backwards is allowed for revisions
  if (nextIndex < currentIndex) {
    return { allowed: true };
  }

  // To transition to approved or published, all checklist gates must be cleared
  if ((nextStage === "approved" || nextStage === "published") && !checklistComplete) {
    return {
      allowed: false,
      reason: "All editorial checklist items (audio, thumbnail, sponsor, captions) must be checked before approval.",
    };
  }

  // Cannot jump more than 2 stages forward at once
  if (nextIndex - currentIndex > 2) {
    return { allowed: false, reason: "Cannot skip intermediate review stages." };
  }

  return { allowed: true };
}

/**
 * Generate standard repurposing tree from a longform pillar asset
 */
function generateRepurposedTree(title) {
  const cleanTitle = title.trim();
  return [
    {
      targetPlatform: "youtube_shorts",
      title: `${cleanTitle} - Key Takeaway #1`,
      aspectRatio: "9:16",
      status: "pending",
    },
    {
      targetPlatform: "instagram_reels",
      title: `${cleanTitle} - Viral Hook Clip`,
      aspectRatio: "9:16",
      status: "pending",
    },
    {
      targetPlatform: "tiktok",
      title: `${cleanTitle} - Behind the Scenes / Blooper`,
      aspectRatio: "9:16",
      status: "pending",
    },
    {
      targetPlatform: "twitter_thread",
      title: `Summary Thread: ${cleanTitle}`,
      aspectRatio: "text",
      status: "pending",
    },
    {
      targetPlatform: "linkedin_carousel",
      title: `Framework Slides: ${cleanTitle}`,
      aspectRatio: "1:1",
      status: "pending",
    },
    {
      targetPlatform: "newsletter",
      title: `Deep Dive Edition: ${cleanTitle}`,
      aspectRatio: "text",
      status: "pending",
    },
  ];
}

module.exports = {
  STAGE_ORDER,
  canTransitionStage,
  generateRepurposedTree,
};
