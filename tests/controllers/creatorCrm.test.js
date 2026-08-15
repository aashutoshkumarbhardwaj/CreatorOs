jest.mock("../../model/crmBrand", () => {
  const mockBrandDoc = {
    _id: "brand-123",
    companyName: "Acme Corp",
    category: "Tech",
    status: "lead",
    contactHistory: [],
    save: jest.fn().mockResolvedValue(true),
  };

  return {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    insertMany: jest.fn(),
  };
});

jest.mock("../../model/crmDeal", () => {
  return {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    insertMany: jest.fn(),
  };
});

jest.mock("../../model/crmInvoice", () => {
  return {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    insertMany: jest.fn(),
  };
});

jest.mock("../../model/crmMediaKit", () => {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
});

const CrmBrand = require("../../model/crmBrand");
const CrmDeal = require("../../model/crmDeal");
const CrmInvoice = require("../../model/crmInvoice");
const CrmMediaKit = require("../../model/crmMediaKit");
const {
  getCrmData,
  createBrand,
  getBrands,
  updateBrand,
  deleteBrand,
  addContactHistory,
  createDeal,
  getDeals,
  updateDeal,
  deleteDeal,
  createInvoice,
  getInvoices,
  markInvoicePaid,
  getMediaKit,
  updateMediaKit,
} = require("../../controller/creatorCrmController");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("Creator CRM Controller", () => {
  const userId = "64b7f1f1f1f1f1f1f1f1f1f1";
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: userId, name: "Test Creator" },
      query: {},
      params: {},
      body: {},
    };
    res = createResponse();
  });

  describe("getCrmData", () => {
    it("returns aggregated CRM data feed and seeds default data when empty", async () => {
      CrmDeal.countDocuments.mockResolvedValue(0);
      CrmBrand.countDocuments.mockResolvedValue(0);
      CrmBrand.insertMany.mockResolvedValue([{ companyName: "Adobe Creative Cloud", _id: "b1" }]);
      CrmDeal.insertMany.mockResolvedValue([]);
      CrmInvoice.insertMany.mockResolvedValue([]);
      CrmDeal.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ dealName: "Test Deal", amount: 5000 }]) });
      CrmBrand.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ companyName: "Test Brand" }]) });
      CrmInvoice.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ amount: 1000, status: "pending" }]) });
      CrmMediaKit.findOne.mockResolvedValue({ bio: "Creator Bio" });

      await getCrmData(req, res);

      expect(CrmDeal.insertMany).toHaveBeenCalled();
      expect(CrmBrand.insertMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            deals: expect.any(Array),
            brands: expect.any(Array),
            invoices: expect.any(Array),
            summary: expect.objectContaining({
              totalPipelineValue: 5000,
              totalUnpaidInvoices: 1000,
            }),
          }),
        })
      );
    });
  });

  describe("Brands CRUD", () => {
    it("creates a new brand contact", async () => {
      req.body = { companyName: "Acme Corp", category: "Tech", contactName: "Alice" };
      CrmBrand.create.mockResolvedValue({ _id: "b1", ...req.body, creatorId: userId });

      await createBrand(req, res);

      expect(CrmBrand.create).toHaveBeenCalledWith(expect.objectContaining({ companyName: "Acme Corp", creatorId: userId }));
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("returns 400 if companyName is missing", async () => {
      req.body = {};
      await createBrand(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("adds contact history to brand", async () => {
      req.params = { id: "b1" };
      req.body = { type: "call", note: "Discussed sponsorship terms" };

      const mockBrand = {
        _id: "b1",
        creatorId: userId,
        contactHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      CrmBrand.findOne.mockResolvedValue(mockBrand);

      await addContactHistory(req, res);

      expect(mockBrand.contactHistory.length).toBe(1);
      expect(mockBrand.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockBrand });
    });
  });

  describe("Deals CRUD", () => {
    it("creates a deal", async () => {
      req.body = { dealName: "Q3 Campaign", companyName: "Nike", amount: 8000 };
      CrmDeal.create.mockResolvedValue({ _id: "d1", ...req.body, creatorId: userId });

      await createDeal(req, res);

      expect(CrmDeal.create).toHaveBeenCalledWith(expect.objectContaining({ dealName: "Q3 Campaign", amount: 8000 }));
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("updates a deal stage", async () => {
      req.params = { id: "d1" };
      req.body = { stage: "negotiation" };
      CrmDeal.findOneAndUpdate.mockResolvedValue({ _id: "d1", stage: "negotiation" });

      await updateDeal(req, res);

      expect(CrmDeal.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "d1", creatorId: userId },
        { $set: { stage: "negotiation" } },
        { new: true, runValidators: true }
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { _id: "d1", stage: "negotiation" } });
    });
  });

  describe("Invoices CRUD", () => {
    it("creates an invoice", async () => {
      req.body = { companyName: "Skillshare", invoiceName: "Annual Sub", amount: 12000 };
      CrmInvoice.countDocuments.mockResolvedValue(0);
      CrmInvoice.create.mockResolvedValue({ _id: "i1", invoiceNumber: "INV-2026-001", ...req.body });

      await createInvoice(req, res);

      expect(CrmInvoice.create).toHaveBeenCalledWith(expect.objectContaining({ companyName: "Skillshare", amount: 12000 }));
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("marks invoice as paid", async () => {
      req.params = { id: "i1" };
      CrmInvoice.findOneAndUpdate.mockResolvedValue({ _id: "i1", status: "paid" });

      await markInvoicePaid(req, res);

      expect(CrmInvoice.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "i1", creatorId: userId },
        { $set: { status: "paid", paidAt: expect.any(Date) } },
        { new: true }
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { _id: "i1", status: "paid" } });
    });
  });

  describe("MediaKit", () => {
    it("gets media kit", async () => {
      CrmMediaKit.findOne.mockResolvedValue({ creatorId: userId, bio: "My bio" });
      await getMediaKit(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ bio: "My bio" }) });
    });
  });
});
