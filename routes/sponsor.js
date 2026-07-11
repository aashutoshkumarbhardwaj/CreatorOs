const express = require("express");
const { getSponsors, createSponsor, updateSponsor, deleteSponsor } = require("../controller/sponsor");
const { restrictToLoggedinUserOnly } = require("../middleware/auth");

const router = express.Router();

router.use(restrictToLoggedinUserOnly);

/**
 * @swagger
 * /api/sponsors:
 *   get:
 *     summary: Get all sponsors
 *     description: Retrieve the pipeline board of sponsors for the logged-in creator.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sponsors
 */
router.route("/")
    .get(getSponsors)
    .post(createSponsor);

router.route("/:id")
    .put(updateSponsor)
    .delete(deleteSponsor);

module.exports = router;
