const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    process.env[key] = value;
  }
});

const Creator = require("./model/creator");
const Post = require("./model/post");
const AnalyticsSnapshot = require("./model/analyticsSnapshot");
const EngagementHistory = require("./model/engagementHistory");

const USER_ID = "6a4c6974698201c70d5ea519";

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB for seeding...");

  let creator = await Creator.findOne({ userId: USER_ID });
  if (!creator) {
    creator = await Creator.create({
      userId: USER_ID,
      username: "sam_creates",
      platform: "instagram",
      profileUrl: "https://instagram.com/sam_creates",
      bio: "Building in public. Creator tools & tech.",
      lastRefreshedAt: new Date(),
    });
    console.log("Created Creator:", creator._id.toString());
  } else {
    console.log("Creator already exists:", creator._id.toString());
  }

  await Post.deleteMany({ creatorId: creator._id });
  const posts = [];
  for (let i = 0; i < 12; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const postedAt = new Date();
    postedAt.setDate(postedAt.getDate() - daysAgo);

    posts.push({
      creatorId: creator._id,
      platform: "instagram",
      postId: `seed_post_${i + 1}`,
      caption: `Sample post #${i + 1} - behind the scenes content`,
      mediaUrl: "",
      likes: Math.floor(Math.random() * 900) + 100,
      comments: Math.floor(Math.random() * 60) + 5,
      views: Math.floor(Math.random() * 9000) + 1000,
      postedAt,
    });
  }
  const createdPosts = await Post.insertMany(posts);
  console.log(`Created ${createdPosts.length} Posts`);

  const totalLikes = createdPosts.reduce((sum, p) => sum + p.likes, 0);
  const totalComments = createdPosts.reduce((sum, p) => sum + p.comments, 0);
  const totalViews = createdPosts.reduce((sum, p) => sum + p.views, 0);

  await AnalyticsSnapshot.deleteMany({ creatorId: creator._id });
  const followers = 15234;
  const engagementRate = Number(
    (((totalLikes + totalComments) / (followers || 1)) * 100).toFixed(2)
  );

  const snapshot = await AnalyticsSnapshot.create({
    creatorId: creator._id,
    platform: "instagram",
    followers,
    following: 412,
    totalPosts: createdPosts.length,
    totalLikes,
    totalComments,
    totalViews,
    engagementRate,
    snapshotDate: new Date(),
  });
  console.log("Created AnalyticsSnapshot:", snapshot._id.toString());

  await EngagementHistory.deleteMany({ creatorId: creator._id });
  const history = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    history.push({
      creatorId: creator._id,
      snapshotId: snapshot._id,
      date,
      followersGrowth: Math.floor(Math.random() * 50) - 5,
      likesGrowth: Math.floor(Math.random() * 200),
      commentsGrowth: Math.floor(Math.random() * 20),
      engagementRateDelta: Number((Math.random() * 0.5 - 0.1).toFixed(2)),
    });
  }
  await EngagementHistory.insertMany(history);
  console.log(`Created ${history.length} EngagementHistory records`);

  console.log("\nSeeding complete!");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});