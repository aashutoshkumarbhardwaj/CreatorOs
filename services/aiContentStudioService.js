/**
 * AI Content Studio Engine
 * Multi-platform formatting, viral hook templates, and hashtag density analyzer
 */

const PLATFORM_LIMITS = {
  twitter: 280,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
  general: 4000,
};

/**
 * Generate 5 distinctive psychological hook frameworks
 */
function generateViralHooks(topic, niche = "general") {
  const cleanTopic = topic.trim();
  return [
    {
      style: "Curiosity Gap",
      text: `Nobody is talking about how ${cleanTopic} is quietly replacing old methods. Here is why:`,
    },
    {
      style: "Contrarian / Hot Take",
      text: `Stop doing ${cleanTopic} the conventional way. 95% of creators are wasting hours doing this:`,
    },
    {
      style: "Negative Consequence / Urgency",
      text: `If you are not paying attention to ${cleanTopic} right now, you will regret it in 6 months.`,
    },
    {
      style: "Statistical / Authority",
      text: `I spent 30 days analyzing ${cleanTopic} in the ${niche} space. Here are the 3 non-obvious patterns:`,
    },
    {
      style: "Storytelling / Transformation",
      text: `6 months ago, I had zero clue about ${cleanTopic}. Today, it generates 80% of my results:`,
    },
  ];
}

/**
 * Generate structured video script outline
 */
function generateVideoScriptOutline(topic, tone = "informative") {
  return {
    hook: `Stop scrolling if you want to master ${topic} without burning out.`,
    retentionBuffer: `In the next 60 seconds, I will break down the exact framework I used to solve this.`,
    mainPoints: [
      `Step 1: Identify your highest-leverage bottleneck in ${topic}.`,
      `Step 2: Automate and eliminate the repetitive friction points.`,
      `Step 3: Measure conversion outcomes rather than surface-level vanity metrics.`,
    ],
    climax: `The real secret is not working twice as hard—it is setting up the foundational system first.`,
    callToAction: `Drop a comment below with your biggest question on ${topic}, and save this for later!`,
  };
}

/**
 * Multi-platform caption generator respecting native constraints
 */
function adaptToPlatforms(topic, coreMessage, selectedPlatforms = ["twitter", "instagram", "linkedin"]) {
  const results = [];

  for (const platform of selectedPlatforms) {
    const limit = PLATFORM_LIMITS[platform] || 2000;
    let caption = "";
    let hashtags = [];
    let cta = "";

    if (platform === "twitter") {
      caption = `Key takeaway on ${topic}:\n\n${coreMessage.slice(0, 180)}...\n\nWhat do you think?`;
      hashtags = [`#${topic.replace(/\s+/g, "")}`, "#CreatorEconomy"];
      cta = "RT if helpful!";
    } else if (platform === "instagram" || platform === "tiktok") {
      caption = `🔥 Everything you need to know about ${topic}:\n\n${coreMessage}\n\nSwipe through for details.\n\nSave this post so you don't lose it later!`;
      hashtags = [`#${topic.replace(/\s+/g, "")}`, "#CreatorTips", "#GrowthHacking", "#ViralContent", "#CreatorOs"];
      cta = "Save & Share with a fellow creator!";
    } else if (platform === "linkedin") {
      caption = `A deep dive into ${topic}:\n\n${coreMessage}\n\nOver the past year, one trend has become undeniable in the creator ecosystem. Leaders who systematize early compound their advantage.\n\nHave you noticed this shift in your industry?`;
      hashtags = [`#${topic.replace(/\s+/g, "")}`, "#ContentStrategy", "#Leadership", "#CreatorBusiness"];
      cta = "Join the discussion in the comments.";
    } else {
      caption = `${topic}:\n\n${coreMessage}`;
      hashtags = [`#${topic.replace(/\s+/g, "")}`];
      cta = "Subscribe for more.";
    }

    if (caption.length > limit) {
      caption = caption.slice(0, limit - 20) + "...";
    }

    results.push({
      platform,
      caption,
      characterCount: caption.length,
      hashtags,
      callToAction: cta,
    });
  }

  return results;
}

/**
 * Hashtag density & competition tier analyzer
 */
function analyzeHashtags(seedTopic) {
  const clean = seedTopic.toLowerCase().replace(/[^\w]/g, "");
  return [
    { tag: `#${clean}`, tier: "high", estimatedReachScore: 92 },
    { tag: `#${clean}tips`, tier: "medium", estimatedReachScore: 68 },
    { tag: `#${clean}strategy`, tier: "medium", estimatedReachScore: 59 },
    { tag: `#${clean}guide2026`, tier: "niche", estimatedReachScore: 34 },
    { tag: `#${clean}secrets`, tier: "niche", estimatedReachScore: 28 },
    { tag: "#creatorgrowth", tier: "high", estimatedReachScore: 95 },
  ];
}

module.exports = {
  PLATFORM_LIMITS,
  generateViralHooks,
  generateVideoScriptOutline,
  adaptToPlatforms,
  analyzeHashtags,
};
