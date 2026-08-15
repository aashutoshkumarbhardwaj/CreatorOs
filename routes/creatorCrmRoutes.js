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

const {
  validateCrmQuery,
  validateBrand,
  validateDeal,
  validateInvoice,
  validateMediaKit,
} = require("../middleware/validators/creatorCrmValidator");

router.use(protect);

// Combined feed
router.get("/data", validateCrmQuery, getCrmData);

// Brands & Sponsors
router.route("/brands").get(getBrands).post(validateBrand, createBrand);
router.route("/brands/:id").put(validateBrand, updateBrand).delete(deleteBrand);
router.post("/brands/:id/contact-history", addContactHistory);

// Deals & Campaign Pipeline
router.route("/deals").get(getDeals).post(validateDeal, createDeal);
router.route("/deals/:id").put(validateDeal, updateDeal).delete(deleteDeal);
router.post("/deals/:id/tasks", addTaskToDeal);
router.patch("/deals/:id/tasks/:taskId", toggleDealTask);
router.post("/deals/:id/contracts", addContractToDeal);

// Invoices & Payments
router.route("/invoices").get(getInvoices).post(validateInvoice, createInvoice);
router.route("/invoices/:id").put(validateInvoice, updateInvoice).delete(deleteInvoice);
router.patch("/invoices/:id/paid", markInvoicePaid);

// Media Kit
router.route("/media-kit").get(getMediaKit).put(validateMediaKit, updateMediaKit);

module.exports = router;
