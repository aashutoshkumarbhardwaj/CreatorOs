const AudienceSubscriber = require("../model/audienceSubscriber");
const EmailCampaign = require("../model/emailCampaign");

/**
 * Add single subscriber
 */
exports.addSubscriber = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.body.creatorId;
    const { email, firstName, lastName, tags, source } = req.body;

    if (!creatorId || !email) {
      return res.status(400).json({
        success: false,
        message: "creatorId and email are required.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    let subscriber = await AudienceSubscriber.findOne({ creatorId, email: cleanEmail });

    if (subscriber) {
      if (subscriber.status === "unsubscribed") {
        subscriber.status = "subscribed";
      }
      if (tags && Array.isArray(tags)) {
        subscriber.tags = Array.from(new Set([...subscriber.tags, ...tags.map((t) => t.toLowerCase())]));
      }
      if (firstName) subscriber.firstName = firstName;
      if (lastName) subscriber.lastName = lastName;
      await subscriber.save();
      return res.status(200).json({
        success: true,
        message: "Subscriber profile updated successfully",
        subscriber,
      });
    }

    subscriber = new AudienceSubscriber({
      creatorId,
      email: cleanEmail,
      firstName: firstName || "",
      lastName: lastName || "",
      tags: Array.isArray(tags) ? tags.map((t) => t.toLowerCase()) : [],
      source: source || "smart_bio",
      status: "subscribed",
    });

    await subscriber.save();

    return res.status(201).json({
      success: true,
      message: "Subscriber added successfully",
      subscriber,
    });
  } catch (error) {
    console.error("Add subscriber error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add subscriber",
      error: error.message,
    });
  }
};

/**
 * Batch import subscribers
 */
exports.importSubscribersBatch = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { subscribers } = req.body;

    if (!Array.isArray(subscribers) || subscribers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Subscribers array is required",
      });
    }

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const sub of subscribers) {
      if (!sub.email) {
        failed++;
        continue;
      }
      const cleanEmail = sub.email.toLowerCase().trim();
      const existing = await AudienceSubscriber.findOne({ creatorId, email: cleanEmail });
      if (existing) {
        if (sub.tags && Array.isArray(sub.tags)) {
          existing.tags = Array.from(new Set([...existing.tags, ...sub.tags.map((t) => t.toLowerCase())]));
        }
        if (sub.firstName) existing.firstName = sub.firstName;
        if (sub.lastName) existing.lastName = sub.lastName;
        await existing.save();
        updated++;
      } else {
        await AudienceSubscriber.create({
          creatorId,
          email: cleanEmail,
          firstName: sub.firstName || "",
          lastName: sub.lastName || "",
          tags: Array.isArray(sub.tags) ? sub.tags.map((t) => t.toLowerCase()) : [],
          source: "csv_import",
        });
        inserted++;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Batch import completed",
      summary: { inserted, updated, failed, total: subscribers.length },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to batch import subscribers",
      error: error.message,
    });
  }
};

/**
 * List subscribers with tag and status filtering
 */
exports.getSubscribers = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { status, tag, search, page = 1, limit = 25 } = req.query;

    const query = { creatorId };
    if (status) query.status = status;
    if (tag) query.tags = tag.toLowerCase();
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [subscribers, total] = await Promise.all([
      AudienceSubscriber.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AudienceSubscriber.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: subscribers.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      subscribers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get subscribers",
      error: error.message,
    });
  }
};

/**
 * Unsubscribe handler (public via token)
 */
exports.handleUnsubscribe = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const subscriber = await AudienceSubscriber.findOne({ unsubscribeToken: token });
    if (!subscriber) {
      return res.status(404).json({ success: false, message: "Subscriber not found or invalid token" });
    }

    subscriber.status = "unsubscribed";
    subscriber.lastActivityAt = new Date();
    await subscriber.save();

    return res.status(200).json({
      success: true,
      message: "You have been successfully unsubscribed from this creator's newsletter.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process unsubscribe",
      error: error.message,
    });
  }
};

/**
 * Create Email Campaign
 */
exports.createCampaign = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { title, subject, previewText, fromName, fromEmail, htmlContent, plainTextContent, targetTags, scheduledAt } =
      req.body;

    if (!title || !subject || !fromEmail || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: "title, subject, fromEmail, and htmlContent are required.",
      });
    }

    const campaign = new EmailCampaign({
      creatorId,
      title,
      subject,
      previewText: previewText || "",
      fromName: fromName || "Creator",
      fromEmail,
      htmlContent,
      plainTextContent: plainTextContent || "",
      targetTags: Array.isArray(targetTags) ? targetTags.map((t) => t.toLowerCase()) : [],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? "scheduled" : "draft",
    });

    await campaign.save();

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      campaign,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create campaign",
      error: error.message,
    });
  }
};

/**
 * Broadcast dispatch simulation for campaign
 */
exports.sendCampaignBroadcast = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;
    const { id } = req.params;

    const campaign = await EmailCampaign.findOne({ _id: id, creatorId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    if (campaign.status === "sent" || campaign.status === "sending") {
      return res.status(400).json({ success: false, message: "Campaign already sent or sending" });
    }

    const subQuery = { creatorId, status: "subscribed" };
    if (campaign.targetTags && campaign.targetTags.length > 0) {
      subQuery.tags = { $in: campaign.targetTags };
    }

    const recipients = await AudienceSubscriber.find(subQuery);
    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active subscribers found matching campaign criteria",
      });
    }

    campaign.status = "sending";
    campaign.metrics.recipientsCount = recipients.length;
    await campaign.save();

    // Simulate batch dispatch delivery
    for (const sub of recipients) {
      campaign.interpolateTemplate(sub);
      sub.totalCampaignsReceived += 1;
      await sub.save();
    }

    campaign.status = "sent";
    campaign.sentAt = new Date();
    campaign.metrics.sentCount = recipients.length;
    await campaign.save();

    return res.status(200).json({
      success: true,
      message: "Campaign broadcast sent successfully",
      campaign,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to dispatch campaign",
      error: error.message,
    });
  }
};

/**
 * Record Tracking Pixel Open
 */
exports.recordTrackingPixelOpen = async (req, res) => {
  try {
    const { campaignId, subscriberId } = req.params;

    const [campaign, subscriber] = await Promise.all([
      EmailCampaign.findById(campaignId),
      AudienceSubscriber.findById(subscriberId),
    ]);

    if (campaign && subscriber) {
      campaign.metrics.openedCount += 1;
      await campaign.save();

      subscriber.updateEngagement("open");
      await subscriber.save();
    }

    // Return 1x1 transparent GIF
    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": pixel.length,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    return res.end(pixel);
  } catch (error) {
    return res.status(500).end();
  }
};

/**
 * Get Audience Analytics Overview
 */
exports.getAudienceAnalytics = async (req, res) => {
  try {
    const creatorId = req.user && req.user._id ? req.user._id : req.user;

    const [subscribers, campaigns] = await Promise.all([
      AudienceSubscriber.find({ creatorId }),
      EmailCampaign.find({ creatorId }),
    ]);

    const totalSubscribers = subscribers.length;
    const activeSubscribers = subscribers.filter((s) => s.status === "subscribed").length;
    const unsubscribedCount = subscribers.filter((s) => s.status === "unsubscribed").length;

    const totalSent = campaigns.reduce((sum, c) => sum + (c.metrics.sentCount || 0), 0);
    const totalOpens = campaigns.reduce((sum, c) => sum + (c.metrics.openedCount || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.metrics.clickedCount || 0), 0);

    const openRate = totalSent > 0 ? Number(((totalOpens / totalSent) * 100).toFixed(1)) : 0;
    const clickRate = totalSent > 0 ? Number(((totalClicks / totalSent) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      analytics: {
        totalSubscribers,
        activeSubscribers,
        unsubscribedCount,
        campaignsCount: campaigns.length,
        totalSent,
        totalOpens,
        totalClicks,
        openRate,
        clickRate,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate audience analytics",
      error: error.message,
    });
  }
};
