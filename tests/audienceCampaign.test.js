const AudienceSubscriber = require("../model/audienceSubscriber");
const EmailCampaign = require("../model/emailCampaign");
const mongoose = require("mongoose");

describe("Audience Management & Email Campaign Unit Tests", () => {
  const dummyCreatorId = new mongoose.Types.ObjectId();

  describe("EmailCampaign Template Interpolation", () => {
    let sampleCampaign;
    let sampleSubscriber;

    beforeEach(() => {
      sampleCampaign = new EmailCampaign({
        creatorId: dummyCreatorId,
        title: "Weekly Creator Dispatch #42",
        subject: "Hey {{firstName}}, here is your weekly breakdown!",
        fromName: "Alex Creator",
        fromEmail: "alex@creator.com",
        htmlContent:
          "<h1>Hello {{firstName}} {{lastName}}</h1><p>Thanks for subscribing with {{email}}.</p><a href='{{unsubscribeUrl}}'>Unsubscribe</a>",
      });

      sampleSubscriber = new AudienceSubscriber({
        creatorId: dummyCreatorId,
        email: "subscriber@example.com",
        firstName: "Jordan",
        lastName: "Lee",
        tags: ["youtube", "vip"],
        unsubscribeToken: "tok_test_unsubscribe_12345",
      });
    });

    it("should correctly substitute template variables and append tracking pixel", () => {
      const rendered = sampleCampaign.interpolateTemplate(sampleSubscriber, "https://test.creatoros.io");

      expect(rendered.subject).toBe("Hey Jordan, here is your weekly breakdown!");
      expect(rendered.html).toContain("Hello Jordan Lee");
      expect(rendered.html).toContain("subscriber@example.com");
      expect(rendered.html).toContain(
        "https://test.creatoros.io/api/audience/unsubscribe/tok_test_unsubscribe_12345"
      );
      expect(rendered.html).toContain(
        `<img src="https://test.creatoros.io/api/audience/track/open/${sampleCampaign._id}/${sampleSubscriber._id}"`
      );
    });

    it("should fall back gracefully if subscriber names are omitted", () => {
      const namelessSubscriber = new AudienceSubscriber({
        creatorId: dummyCreatorId,
        email: "noname@example.com",
        unsubscribeToken: "tok_noname",
      });

      const rendered = sampleCampaign.interpolateTemplate(namelessSubscriber, "https://test.creatoros.io");
      expect(rendered.subject).toBe("Hey Friend, here is your weekly breakdown!");
      expect(rendered.html).toContain("Hello Friend");
    });
  });

  describe("AudienceSubscriber Engagement Methods", () => {
    it("should update engagement score and counts on open and click", () => {
      const sub = new AudienceSubscriber({
        creatorId: dummyCreatorId,
        email: "fan@example.com",
        engagementScore: 50,
      });

      sub.updateEngagement("open");
      expect(sub.totalOpens).toBe(1);
      expect(sub.engagementScore).toBe(55);

      sub.updateEngagement("click");
      expect(sub.totalClicks).toBe(1);
      expect(sub.engagementScore).toBe(65);

      sub.updateEngagement("bounce");
      expect(sub.status).toBe("bounced");
      expect(sub.engagementScore).toBe(0);
    });
  });
});
