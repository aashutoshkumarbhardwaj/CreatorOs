const express = require("express");

const router = express.Router();

const inboxController = require("../controller/inboxController");

router.get("/", inboxController.getInbox);

module.exports = router;