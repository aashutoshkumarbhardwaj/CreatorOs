const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createProduct,
  getProducts,
  getProductDetails,
  updateProduct,
  deleteProduct,
  createCheckoutOrder,
  validateAndConsumeDownload,
  refundOrder,
  getSalesReport,
} = require("../controller/digitalStoreController");

// Public routes for storefront browsing, purchasing, and downloading
router.get("/public/products", getProducts);
router.get("/public/product/:idOrSlug", getProductDetails);
router.post("/public/checkout", createCheckoutOrder);
router.get("/download/:token", validateAndConsumeDownload);

// Creator protected routes
router.use(protect);
router.get("/products", getProducts);
router.post("/products", createProduct);
router.get("/product/:idOrSlug", getProductDetails);
router.put("/product/:id", updateProduct);
router.delete("/product/:id", deleteProduct);
router.post("/order/:orderId/refund", refundOrder);
router.get("/analytics/sales-report", getSalesReport);

module.exports = router;
