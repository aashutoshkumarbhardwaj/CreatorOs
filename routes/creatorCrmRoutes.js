const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
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
} = require("../controller/creatorCrmController");

router.use(protect);

// Combined feed
router.get("/data", getCrmData);

// Brands & Sponsors
router.route("/brands").get(getBrands).post(createBrand);
router.route("/brands/:id").put(updateBrand).delete(deleteBrand);
router.post("/brands/:id/contact-history", addContactHistory);

// Deals & Campaign Pipeline
router.route("/deals").get(getDeals).post(createDeal);
router.route("/deals/:id").put(updateDeal).delete(deleteDeal);
router.post("/deals/:id/tasks", addTaskToDeal);
router.patch("/deals/:id/tasks/:taskId", toggleDealTask);
router.post("/deals/:id/contracts", addContractToDeal);

// Invoices & Payments
router.route("/invoices").get(getInvoices).post(createInvoice);
router.route("/invoices/:id").put(updateInvoice).delete(deleteInvoice);
router.patch("/invoices/:id/paid", markInvoicePaid);

// Media Kit
router.route("/media-kit").get(getMediaKit).put(updateMediaKit);

module.exports = router;
