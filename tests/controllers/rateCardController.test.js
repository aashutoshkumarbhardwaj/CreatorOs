const {
  createRateCard,
  getRateCards,
  getPublicRateCard,
  updateRateCard,
  deleteRateCard,
} = require("../../controller/rateCardController");
const CreatorRateCard = require("../../model/creatorRateCard");
const mongoose = require("mongoose");

jest.mock("../../model/creatorRateCard");

describe("rateCardController unit tests", () => {
  let req;
  let res;
  const mockCreatorId = new mongoose.Types.ObjectId();
  const mockCardId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: mockCreatorId },
      params: {},
      query: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("updateRateCard", () => {
    it("should return 404 if rate card is not found", async () => {
      req.params.id = mockCardId.toString();
      CreatorRateCard.findOne.mockResolvedValue(null);

      await updateRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: "Rate card not found" })
      );
    });

    it("should reject empty or whitespace-only title update with 400", async () => {
      req.params.id = mockCardId.toString();
      const mockCard = {
        _id: mockCardId,
        creatorId: mockCreatorId,
        title: "Original Title",
        slug: "original-title",
        save: jest.fn(),
      };
      CreatorRateCard.findOne.mockResolvedValue(mockCard);

      req.body = { title: "   " };
      await updateRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Title cannot be empty",
      });
      expect(mockCard.save).not.toHaveBeenCalled();
    });

    it("should reject non-string title with 400", async () => {
      req.params.id = mockCardId.toString();
      const mockCard = {
        _id: mockCardId,
        creatorId: mockCreatorId,
        title: "Original Title",
        slug: "original-title",
        save: jest.fn(),
      };
      CreatorRateCard.findOne.mockResolvedValue(mockCard);

      req.body = { title: 12345 };
      await updateRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Title cannot be empty",
      });
      expect(mockCard.save).not.toHaveBeenCalled();
    });

    it("should preserve slug if title is unchanged", async () => {
      req.params.id = mockCardId.toString();
      const mockCard = {
        _id: mockCardId,
        creatorId: mockCreatorId,
        title: "Unchanged Title",
        slug: "unchanged-title",
        niche: "tech",
        save: jest.fn().mockResolvedValue(true),
      };
      CreatorRateCard.findOne.mockResolvedValue(mockCard);

      req.body = { title: "Unchanged Title", niche: "finance" };
      await updateRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCard.title).toBe("Unchanged Title");
      expect(mockCard.slug).toBe("unchanged-title");
      expect(mockCard.niche).toBe("finance");
      expect(mockCard.save).toHaveBeenCalled();
    });

    it("should regenerate slug when title is modified", async () => {
      req.params.id = mockCardId.toString();
      const mockCard = {
        _id: mockCardId,
        creatorId: mockCreatorId,
        title: "Old Rate Card",
        slug: "old-rate-card",
        save: jest.fn().mockResolvedValue(true),
      };
      // First findOne finds the card to update
      CreatorRateCard.findOne
        .mockResolvedValueOnce(mockCard)
        // Second findOne checks slug collision with other cards (no collision)
        .mockResolvedValueOnce(null);

      req.body = { title: "New 2026 Sponsorships" };
      await updateRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCard.title).toBe("New 2026 Sponsorships");
      expect(mockCard.slug).toBe("new-2026-sponsorships");
      expect(mockCard.save).toHaveBeenCalled();
    });

    it("should deduplicate slug when new title collides with another card owned by the same creator", async () => {
      req.params.id = mockCardId.toString();
      const collidingCardId = new mongoose.Types.ObjectId();
      const mockCard = {
        _id: mockCardId,
        creatorId: mockCreatorId,
        title: "Original Title",
        slug: "original-title",
        save: jest.fn().mockResolvedValue(true),
      };

      // 1: find card to update
      // 2: check "tech-rate-card" -> collision found
      // 3: check "tech-rate-card-1" -> no collision
      CreatorRateCard.findOne
        .mockResolvedValueOnce(mockCard)
        .mockResolvedValueOnce({ _id: collidingCardId, slug: "tech-rate-card" })
        .mockResolvedValueOnce(null);

      req.body = { title: "Tech Rate Card" };
      await updateRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCard.title).toBe("Tech Rate Card");
      expect(mockCard.slug).toBe("tech-rate-card-1");
      expect(mockCard.save).toHaveBeenCalled();
    });

    it("should fallback to rate-card when title contains only symbols/emojis", async () => {
      req.params.id = mockCardId.toString();
      const mockCard = {
        _id: mockCardId,
        creatorId: mockCreatorId,
        title: "Old Title",
        slug: "old-title",
        save: jest.fn().mockResolvedValue(true),
      };

      CreatorRateCard.findOne
        .mockResolvedValueOnce(mockCard)
        .mockResolvedValueOnce(null);

      req.body = { title: "✨🚀🎉" };
      await updateRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCard.title).toBe("✨🚀🎉");
      expect(mockCard.slug).toBe("rate-card");
      expect(mockCard.save).toHaveBeenCalled();
    });
  });

  describe("createRateCard", () => {
    it("should reject creation when title is missing or deliverables are empty", async () => {
      req.body = { title: "", deliverables: [] };
      await createRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "title and at least one deliverable are required",
        })
      );
    });

    it("should create card with unique slug and fallback when title is emoji-only", async () => {
      req.body = {
        title: "🔥",
        deliverables: [{ deliverableType: "dedicated_video", platform: "youtube", basePrice: 500 }],
      };

      CreatorRateCard.findOne.mockResolvedValueOnce(null);
      const mockSave = jest.fn().mockResolvedValue(true);
      CreatorRateCard.mockImplementation(function (data) {
        Object.assign(this, data);
        this.save = mockSave;
      });

      await createRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Rate card created successfully",
        })
      );
    });
  });

  describe("getRateCards", () => {
    it("should return all rate cards for the creator sorted by createdAt desc", async () => {
      const mockCards = [{ title: "Card 1" }, { title: "Card 2" }];
      const sortMock = jest.fn().mockResolvedValue(mockCards);
      CreatorRateCard.find.mockReturnValue({ sort: sortMock });

      await getRateCards(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        cards: mockCards,
      });
    });
  });

  describe("getPublicRateCard", () => {
    it("should return 404 if no public card is found for slug", async () => {
      req.params.slug = "nonexistent-slug";
      CreatorRateCard.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      await getPublicRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Public rate card not found",
      });
    });

    it("should return public card without agencyCommissionPercent", async () => {
      req.params.slug = "my-rate-card";
      const fullCard = {
        title: "My Rate Card",
        slug: "my-rate-card",
        agencyCommissionPercent: 15,
        currency: "USD",
      };
      CreatorRateCard.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([fullCard]) });

      await getPublicRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        card: {
          title: "My Rate Card",
          slug: "my-rate-card",
          currency: "USD",
        },
      });
    });

    it("should return 409 if multiple public cards share slug and creatorId is omitted", async () => {
      req.params.slug = "shared-slug";
      const cards = [
        { creatorId: "creatorA", title: "Card A" },
        { creatorId: "creatorB", title: "Card B" },
      ];
      CreatorRateCard.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(cards) });

      await getPublicRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Multiple public rate cards share this slug"),
        })
      );
    });
  });

  describe("deleteRateCard", () => {
    it("should delete card and return 200 on success", async () => {
      req.params.id = mockCardId.toString();
      CreatorRateCard.findOneAndDelete.mockResolvedValue({ _id: mockCardId });

      await deleteRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Rate card deleted successfully",
      });
    });

    it("should return 404 if card is not found", async () => {
      req.params.id = mockCardId.toString();
      CreatorRateCard.findOneAndDelete.mockResolvedValue(null);

      await deleteRateCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Rate card not found",
      });
    });
  });
});
