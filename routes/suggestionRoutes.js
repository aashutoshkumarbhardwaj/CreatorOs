const express = require('express');
const router = express.Router();
const { getPage, getSuggestions } = require('../controller/suggestionController');


/**
 * @swagger
 * /:
 *   get:
 *     summary: GET request for /
 *     description: Automatically generated swagger documentation for /
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
router.get('/', getPage);

/**
 * @swagger
 * /:
 *   post:
 *     summary: POST request for /
 *     description: Automatically generated swagger documentation for /
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
router.post('/', getSuggestions);

module.exports = router;