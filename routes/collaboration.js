const express = require('express');
const router = express.Router();
const { getCreatorCrmPage, sendCollaboratorInvite } = require('../controller/collaborationController');
const { preventContributorWrites } = require('../middleware/auth');
const { inviteCollaboratorValidator } = require('../middleware/validators');


/**
 * @swagger
 * /services/creator-crm:
 *   get:
 *     summary: Get Creator CRM page
 *     description: Retrieves the main page for the Creator CRM (Collaboration) service.
 *     responses:
 *       200:
 *         description: Successfully retrieved the CRM page
 *       401:
 *         description: Unauthorized
 */
router.get('/', getCreatorCrmPage);

/**
 * @swagger
 * /services/creator-crm/invite:
 *   post:
 *     summary: Send collaborator invite
 *     description: Sends an email invitation to a new collaborator to join the CRM.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The email address of the collaborator
 *               role:
 *                 type: string
 *                 description: The role assigned to the collaborator
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Contributor writes are prevented)
 */
router.post('/invite', preventContributorWrites, inviteCollaboratorValidator, sendCollaboratorInvite);

module.exports = router;
