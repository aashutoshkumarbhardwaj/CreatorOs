const express = require('express');
const router = express.Router();
const { getCreatorCrmPage, sendCollaboratorInvite } = require('../controller/collaborationController');
const { preventContributorWrites } = require('../middleware/auth');


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
router.get('/', getCreatorCrmPage);

/**
 * @swagger
 * /invite:
 *   post:
 *     summary: POST request for /invite
 *     description: Automatically generated swagger documentation for /invite
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
router.post('/invite', preventContributorWrites, sendCollaboratorInvite);

module.exports = router;
