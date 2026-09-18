const mongoose = require("mongoose");

const emailCampaignSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    previewText: {
      type: String,
      trim: true,
      default: "",
    },
    fromName: {
      type: String,
      required: true,
      trim: true,
    },
    fromEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    htmlContent: {
      type: String,
      required: true,
    },
    plainTextContent: {
      type: String,
      default: "",
    },
    targetTags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "sent", "archived", "cancelled"],
      default: "draft",
      index: true,
    },
    scheduledAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    metrics: {
      recipientsCount: { type: Number, default: 0 },
      sentCount: { type: Number, default: 0 },
      openedCount: { type: Number, default: 0 },
      clickedCount: { type: Number, default: 0 },
      bouncedCount: { type: Number, default: 0 },
      unsubscribedCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

emailCampaignSchema.methods.interpolateTemplate = function (subscriber, baseUrl = "https://creatoros.io") {
  const firstName = subscriber.firstName || "Friend";
  const lastName = subscriber.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const unsubscribeUrl = `${baseUrl}/api/audience/unsubscribe/${subscriber.unsubscribeToken}`;
  const trackingPixelUrl = `${baseUrl}/api/audience/track/open/${this._id}/${subscriber._id}`;

  let content = this.htmlContent
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{\{\s*lastName\s*\}\}/gi, lastName)
    .replace(/\{\{\s*fullName\s*\}\}/gi, fullName)
    .replace(/\{\{\s*email\s*\}\}/gi, subscriber.email)
    .replace(/\{\{\s*unsubscribeUrl\s*\}\}/gi, unsubscribeUrl);

  if (!content.includes(trackingPixelUrl)) {
    content += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
  }

  return {
    subject: this.subject.replace(/\{\{\s*firstName\s*\}\}/gi, firstName),
    html: content,
  };
};

const EmailCampaign = mongoose.model("EmailCampaign", emailCampaignSchema);

module.exports = EmailCampaign;
