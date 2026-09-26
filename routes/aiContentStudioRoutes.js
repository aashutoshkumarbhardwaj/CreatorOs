const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  generateContentSuite,
  getHooksOnly,
  getScriptOnly,
  getSavedDrafts,
  toggleFavorite,
  deleteDraft,
} = require("../controller/aiContentStudioController");

router.use(protect);

router.post("/generate", generateContentSuite);
router.get("/hooks", getHooksOnly);
router.get("/script", getScriptOnly);
router.get("/drafts", getSavedDrafts);
router.patch("/drafts/:id/favorite", toggleFavorite);
router.delete("/drafts/:id", deleteDraft);

module.exports = router;
