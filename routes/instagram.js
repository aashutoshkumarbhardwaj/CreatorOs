const express = require('express');
const { getInstagramProfile } = require('../controller/instagramController');

const router = express.Router();


/**
 * @swagger
 * /profile:
 *   get:
 *     summary: GET request for /profile
 *     description: Automatically generated swagger documentation for /profile
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/profile', getInstagramProfile);

module.exports = router;
