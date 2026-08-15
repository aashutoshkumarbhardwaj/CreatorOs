const asyncHandler = require("../utils/asyncHandler");
const CrmBrand = require("../model/crmBrand");
const CrmDeal = require("../model/crmDeal");
const CrmInvoice = require("../model/crmInvoice");
const CrmMediaKit = require("../model/crmMediaKit");
const User = require("../model/user");

function getUserId(req) {
  return req.user?.id || req.user?._id;
}

async function seedInitialCrmData(userId) {
  const dealCount = await CrmDeal.countDocuments({ creatorId: userId });
  const brandCount = await CrmBrand.countDocuments({ creatorId: userId });

  if (dealCount === 0 && brandCount === 0) {
    const defaultBrands = [
      {
        creatorId: userId,
        companyName: "Adobe Creative Cloud",
        category: "Tech",
        contactName: "Sarah Miller",
        contactEmail: "sarah.m@adobe.com",
        contactPhone: "+1 (555) 234-5678",
        website: "https://adobe.com",
        socialLinks: { linkedin: "adobe", instagram: "adobe", twitter: "adobe" },
        status: "negotiating",
        notes: "Key sponsor for summer campaign series.",
        contactHistory: [
          { date: new Date(Date.now() - 86400000 * 2), type: "email", note: "Sent proposal deck for 3 video package." },
          { date: new Date(Date.now() - 86400000 * 5), type: "call", note: "Introductory call with Sarah Miller." },
        ],
      },
      {
        creatorId: userId,
        companyName: "Razer Global",
        category: "Gaming",
        contactName: "James Chen",
        contactEmail: "james.chen@razer.com",
        website: "https://razer.com",
        socialLinks: { twitter: "razer", instagram: "razer" },
        status: "lead",
        notes: "Interested in BlackShark V2 Pro review video.",
      },
      {
        creatorId: userId,
        companyName: "Revolut Business",
        category: "Fintech",
        contactName: "Elena Ross",
        contactEmail: "elena.ross@revolut.com",
        status: "contacted",
        notes: "Tax Season Partnership outreach.",
        contactHistory: [{ date: new Date(Date.now() - 86400000), type: "email", note: "Outreach email sent." }],
      },
      {
        creatorId: userId,
        companyName: "Nespresso",
        category: "Lifestyle",
        contactName: "Marcus Thorne",
        contactEmail: "marcus.t@nespresso.com",
        status: "negotiating",
        notes: "Vertuo Pop Showcase · 3 Reels",
      },
      {
        creatorId: userId,
        companyName: "SquareSpace",
        category: "Tech",
        contactName: "David Hoffman",
        contactEmail: "david@squarespace.com",
        status: "partner",
        notes: "Annual sponsor partner.",
      },
      {
        creatorId: userId,
        companyName: "Skillshare",
        category: "Education",
        contactName: "Clara Vance",
        contactEmail: "clara@skillshare.com",
        status: "partner",
      },
    ];

    const createdBrands = await CrmBrand.insertMany(defaultBrands);
    const brandMap = {};
    (createdBrands || []).forEach((b) => {
      brandMap[b.companyName] = b._id;
    });

    const defaultDeals = [
      {
        creatorId: userId,
        brandId: brandMap["Adobe Creative Cloud"],
        dealName: "Summer Campaign Intro",
        companyName: "Adobe Creative Cloud",
        category: "Tech",
        contactName: "Sarah Miller",
        contactEmail: "sarah.m@adobe.com",
        stage: "lead",
        amount: 5000,
        deliverables: "1 YouTube Dedicated Video + 2 Shorts",
        notes: "Pitching new features in Premiere Pro.",
        tasks: [
          { title: "Send revised media kit rates", priority: "high", completed: true },
          { title: "Schedule follow-up call", priority: "medium", completed: false },
        ],
        contracts: [
          { title: "Adobe_Sponsorship_Draft.pdf", status: "draft" },
        ],
      },
      {
        creatorId: userId,
        brandId: brandMap["Razer Global"],
        dealName: "BlackShark V2 Pro Review",
        companyName: "Razer Global",
        category: "Gaming",
        contactName: "James Chen",
        contactEmail: "james.chen@razer.com",
        stage: "lead",
        amount: 2200,
        deliverables: "1 Unboxing Reel + 1 Short",
      },
      {
        creatorId: userId,
        brandId: brandMap["Revolut Business"],
        dealName: "Tax Season Partnership",
        companyName: "Revolut Business",
        category: "Fintech",
        contactName: "Elena Ross",
        contactEmail: "elena.ross@revolut.com",
        stage: "outreach",
        amount: 3500,
        deliverables: "2 Instagram Posts + Story Link",
        emailedBadge: true,
      },
      {
        creatorId: userId,
        brandId: brandMap["Nespresso"],
        dealName: "Vertuo Pop Showcase",
        companyName: "Nespresso",
        category: "Lifestyle",
        contactName: "Marcus Thorne",
        contactEmail: "marcus.t@nespresso.com",
        stage: "negotiation",
        amount: 8500,
        deliverables: "3 Dedicated Reels + Story Takeover",
        statusTag: "Counter-offer sent",
      },
    ];

    await CrmDeal.insertMany(defaultDeals);

    const defaultInvoices = [
      {
        creatorId: userId,
        invoiceNumber: "INV-2026-001",
        companyName: "Skillshare",
        invoiceName: "Skillshare · Annual Partnership",
        amount: 12000,
        status: "overdue",
        dueDate: new Date(Date.now() - 86400000 * 4),
        notes: "Pending final wire clearance",
      },
      {
        creatorId: userId,
        invoiceNumber: "INV-2026-002",
        companyName: "NordVPN",
        invoiceName: "NordVPN · Mar Sponsorship",
        amount: 4500,
        status: "pending",
        dueDate: new Date(Date.now() + 86400000 * 12),
      },
      {
        creatorId: userId,
        invoiceNumber: "INV-2026-003",
        companyName: "SquareSpace",
        invoiceName: "SquareSpace · Q1 Integration",
        amount: 15950,
        status: "pending",
        dueDate: new Date(Date.now() + 86400000 * 20),
      },
    ];

    await CrmInvoice.insertMany(defaultInvoices);

    await CrmMediaKit.create({
      creatorId: userId,
      bio: "High-engagement Tech & Digital Creator creating premium integrations.",
      stats: { followers: 185000, engagementRate: "5.2%", avgViews: 62000 },
      packages: [
        { name: "Dedicated YouTube Video", price: 4500, description: "8-12 min dedicated video with custom integration." },
        { name: "Instagram Reel Bundle (3x)", price: 3200, description: "3 high-energy vertical video reels." },
        { name: "Multi-Platform Takeover", price: 8000, description: "1 YouTube Video + 2 Reels + Twitter Post." },
      ],
    });
  }
}

// ── GET FULL CRM AGGREGATE DATA ──
const getCrmData = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  await seedInitialCrmData(userId);

  const { q, stage, category, status } = req.query;

  let dealQuery = { creatorId: userId };
  let brandQuery = { creatorId: userId };
  let invoiceQuery = { creatorId: userId };

  if (stage && stage !== "all") {
    dealQuery.stage = stage;
  }
  if (category && category !== "all") {
    dealQuery.category = category;
    brandQuery.category = category;
  }
  if (status && status !== "all") {
    brandQuery.status = status;
    invoiceQuery.status = status;
  }

  if (q && q.trim() !== "") {
    const searchRegex = new RegExp(q.trim(), "i");
    dealQuery.$or = [
      { dealName: searchRegex },
      { companyName: searchRegex },
      { contactName: searchRegex },
      { deliverables: searchRegex },
    ];
    brandQuery.$or = [
      { companyName: searchRegex },
      { contactName: searchRegex },
      { contactEmail: searchRegex },
      { category: searchRegex },
    ];
    invoiceQuery.$or = [
      { invoiceName: searchRegex },
      { companyName: searchRegex },
      { invoiceNumber: searchRegex },
    ];
  }

  const [deals, brands, invoices, mediaKit] = await Promise.all([
    CrmDeal.find(dealQuery).sort({ createdAt: -1 }),
    CrmBrand.find(brandQuery).sort({ createdAt: -1 }),
    CrmInvoice.find(invoiceQuery).sort({ createdAt: -1 }),
    CrmMediaKit.findOne({ creatorId: userId }),
  ]);

  const totalPipelineValue = deals.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalUnpaidInvoices = invoices
    .filter((inv) => inv.status === "pending" || inv.status === "overdue")
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);

  res.json({
    success: true,
    data: {
      deals,
      brands,
      invoices,
      mediaKit,
      summary: {
        totalPipelineValue,
        activeDealsCount: deals.length,
        totalUnpaidInvoices,
        totalBrandsCount: brands.length,
      },
    },
  });
});

// ── BRAND CONTROLLERS ──
const getBrands = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const brands = await CrmBrand.find({ creatorId: userId }).sort({ createdAt: -1 });
  res.json({ success: true, data: brands });
});

const createBrand = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { companyName, category, contactName, contactEmail, contactPhone, website, socialLinks, status, notes } = req.body;

  if (!companyName) {
    return res.status(400).json({ success: false, message: "Company name is required" });
  }

  const brand = await CrmBrand.create({
    creatorId: userId,
    companyName,
    category: category || "Tech",
    contactName,
    contactEmail,
    contactPhone,
    website,
    socialLinks: socialLinks || {},
    status: status || "lead",
    notes,
  });

  res.status(201).json({ success: true, data: brand });
});

const updateBrand = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const brand = await CrmBrand.findOneAndUpdate(
    { _id: req.params.id, creatorId: userId },
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!brand) return res.status(404).json({ success: false, message: "Brand not found" });
  res.json({ success: true, data: brand });
});

const deleteBrand = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const brand = await CrmBrand.findOneAndDelete({ _id: req.params.id, creatorId: userId });
  if (!brand) return res.status(404).json({ success: false, message: "Brand not found" });
  res.json({ success: true, message: "Brand deleted" });
});

const addContactHistory = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { type, note } = req.body;

  if (!note) {
    return res.status(400).json({ success: false, message: "Note is required for contact history" });
  }

  const brand = await CrmBrand.findOne({ _id: req.params.id, creatorId: userId });
  if (!brand) return res.status(404).json({ success: false, message: "Brand not found" });

  brand.contactHistory.unshift({
    date: new Date(),
    type: type || "note",
    note,
    createdBy: req.user?.name || "Creator",
  });

  await brand.save();
  res.json({ success: true, data: brand });
});

// ── DEAL CONTROLLERS ──
const getDeals = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const deals = await CrmDeal.find({ creatorId: userId }).sort({ createdAt: -1 });
  res.json({ success: true, data: deals });
});

const createDeal = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { dealName, companyName, category, contactName, contactEmail, stage, amount, deliverables, statusTag, notes } = req.body;

  if (!dealName || !companyName) {
    return res.status(400).json({ success: false, message: "Deal name and company name are required" });
  }

  const deal = await CrmDeal.create({
    creatorId: userId,
    dealName,
    companyName,
    category: category || "Tech",
    contactName,
    contactEmail,
    stage: stage || "lead",
    amount: Number(amount) || 0,
    deliverables,
    statusTag,
    notes,
  });

  res.status(201).json({ success: true, data: deal });
});

const updateDeal = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const deal = await CrmDeal.findOneAndUpdate(
    { _id: req.params.id, creatorId: userId },
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });
  res.json({ success: true, data: deal });
});

const deleteDeal = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const deal = await CrmDeal.findOneAndDelete({ _id: req.params.id, creatorId: userId });
  if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });
  res.json({ success: true, message: "Deal deleted" });
});

const addTaskToDeal = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { title, dueDate, priority } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, message: "Task title is required" });
  }

  const deal = await CrmDeal.findOne({ _id: req.params.id, creatorId: userId });
  if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });

  deal.tasks.push({ title, dueDate, priority: priority || "medium" });
  await deal.save();

  res.status(201).json({ success: true, data: deal });
});

const toggleDealTask = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { id, taskId } = req.params;

  const deal = await CrmDeal.findOne({ _id: id, creatorId: userId });
  if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });

  const task = deal.tasks.id(taskId);
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });

  task.completed = !task.completed;
  await deal.save();

  res.json({ success: true, data: deal });
});

const addContractToDeal = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { title, status, fileUrl } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, message: "Contract title is required" });
  }

  const deal = await CrmDeal.findOne({ _id: req.params.id, creatorId: userId });
  if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });

  deal.contracts.push({ title, status: status || "draft", fileUrl });
  await deal.save();

  res.status(201).json({ success: true, data: deal });
});

// ── INVOICE CONTROLLERS ──
const getInvoices = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const invoices = await CrmInvoice.find({ creatorId: userId }).sort({ createdAt: -1 });
  res.json({ success: true, data: invoices });
});

const createInvoice = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { companyName, invoiceName, amount, status, dueDate, notes } = req.body;

  if (!companyName || !invoiceName || amount === undefined) {
    return res.status(400).json({ success: false, message: "Company name, invoice name, and amount are required" });
  }

  const count = await CrmInvoice.countDocuments({ creatorId: userId });
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

  const invoice = await CrmInvoice.create({
    creatorId: userId,
    invoiceNumber,
    companyName,
    invoiceName,
    amount: Number(amount),
    status: status || "pending",
    dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 86400000 * 14),
    notes,
  });

  res.status(201).json({ success: true, data: invoice });
});

const updateInvoice = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const invoice = await CrmInvoice.findOneAndUpdate(
    { _id: req.params.id, creatorId: userId },
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
  res.json({ success: true, data: invoice });
});

const deleteInvoice = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const invoice = await CrmInvoice.findOneAndDelete({ _id: req.params.id, creatorId: userId });
  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
  res.json({ success: true, message: "Invoice deleted" });
});

const markInvoicePaid = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const invoice = await CrmInvoice.findOneAndUpdate(
    { _id: req.params.id, creatorId: userId },
    { $set: { status: "paid", paidAt: new Date() } },
    { new: true }
  );

  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
  res.json({ success: true, data: invoice });
});

// ── MEDIA KIT CONTROLLERS ──
const getMediaKit = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  let mediaKit = await CrmMediaKit.findOne({ creatorId: userId });

  if (!mediaKit) {
    mediaKit = await CrmMediaKit.create({
      creatorId: userId,
      bio: "Content Creator building high-impact brand partnerships.",
      stats: { followers: 100000, engagementRate: "4.5%", avgViews: 50000 },
      packages: [
        { name: "Dedicated Video Integration", price: 3500, description: "Full video integration with CTA link." },
      ],
    });
  }

  res.json({ success: true, data: mediaKit });
});

const updateMediaKit = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { bio, stats, packages } = req.body;

  const mediaKit = await CrmMediaKit.findOneAndUpdate(
    { creatorId: userId },
    { $set: { bio, stats, packages } },
    { new: true, upsert: true }
  );

  res.json({ success: true, data: mediaKit });
});

module.exports = {
  seedInitialCrmData,
  getCrmData,
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  addContactHistory,
  getDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  addTaskToDeal,
  toggleDealTask,
  addContractToDeal,
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markInvoicePaid,
  getMediaKit,
  updateMediaKit,
};
