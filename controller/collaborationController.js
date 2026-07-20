const crypto = require('crypto');
const Invite = require('../model/invite');
const User = require('../model/user');
const services = require('../services.config');
const { sendInvitationEmail } = require('../utils/email');
const asyncHandler = require('../utils/asyncHandler');
const { getDashboardData } = require('../utils/dashboardHelper');

/**
 * @function buildAccountViewModel
 * @description Constructs the view model containing user account data for rendering the dashboard.
 * @returns {any}
 */
function buildAccountViewModel(userDoc, fallbackUser) {
  const name = userDoc?.name || 'Creator';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'CR';

  return {
    id: fallbackUser.id,
    name,
    email: userDoc?.email || '',
    initials,
  };
}

const getCreatorCrmPage = asyncHandler(async (req, res, next) => {
  const userDoc = await User.findById(req.user.id).select('name email').lean();
  const invites = await Invite.find({ inviter: req.user.id })
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  res.render('creator-crm', {
    user: buildAccountViewModel(userDoc, req.user),
    invites,
    success: null,
    error: null,
  });
});

const { collaborationInviteSchema, collaborationAcceptSchema } = require('../middleware/validators');

const sendCollaboratorInvite = asyncHandler(async (req, res, next) => {
  const result = collaborationInviteSchema.safeParse(req.body);

  if (!result.success) {
    const userDoc = await User.findById(req.user.id).select('name email').lean();
    const invites = await Invite.find({ inviter: req.user.id }).sort({ createdAt: -1 }).limit(12).lean();
    return res.status(400).render('creator-crm', {
      user: buildAccountViewModel(userDoc, req.user),
      invites,
      success: null,
      error: result.error.issues[0].message,
    });
  }

  const { email, projectName, message } = result.data;

  const token = crypto.randomBytes(22).toString('hex');
  const invite = await Invite.create({
    inviter: req.user.id,
    email: email.trim().toLowerCase(),
    projectName: projectName?.trim() || 'CreatorOS Collaboration',
    message: message?.trim(),
    token,
  });

  const inviteUrl = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/invites/accept/${token}`;
  const userDoc = await User.findById(req.user.id).select('name email').lean();

  try {
    await sendInvitationEmail({
      to: invite.email,
      inviterName: userDoc?.name || 'CreatorOS',
      projectName: invite.projectName,
      inviteUrl,
      personalMessage: invite.message,
    });
  } catch (emailError) {
    await Invite.findByIdAndDelete(invite._id);
    const invites = await Invite.find({ inviter: req.user.id }).sort({ createdAt: -1 }).limit(12).lean();
    return res.status(500).render('creator-crm', {
      user: buildAccountViewModel(userDoc, req.user),
      invites,
      success: null,
      error: 'Unable to send invite. Please try again later.',
    });
  }

  const invites = await Invite.find({ inviter: req.user.id }).sort({ createdAt: -1 }).limit(12).lean();
  res.render('creator-crm', {
    user: buildAccountViewModel(userDoc, req.user),
    invites,
    success: `Invite sent successfully to ${invite.email}.`,
    error: null,
  });
});

/**
 * @function renderDashboard
 * @description Renders the main user dashboard view.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
const renderDashboard = async (req, res, options = {}) => {
  const userDoc = await User.findById(req.user.id).select('name email').lean();
  
  const [pending, accepted, expired] = await Promise.all([
    Invite.countDocuments({ inviter: req.user.id, status: 'pending' }),
    Invite.countDocuments({ inviter: req.user.id, status: 'accepted' }),
    Invite.countDocuments({ inviter: req.user.id, status: 'expired' })
  ]);
  
  const inviteSummary = {
    total: pending + accepted + expired,
    pending,
    accepted,
    expired,
  };

  const dashboardData = await getDashboardData(userDoc);

  return res.render('dashboard', {
    user: buildAccountViewModel(userDoc, req.user),
    services,
    inviteSummary,
    dashboardData,
    inviteAcceptMessage: options.inviteAcceptMessage || null,
    inviteAcceptError: options.inviteAcceptError || null,
  });
};

const acceptInvite = asyncHandler(async (req, res, next) => {
  const invite = await Invite.findOne({ token: req.params.token });

  if (!invite) {
    return res.status(404).render('invite-accept', {
      status: 'missing',
      invite: null,
    });
  }

  if (invite.status === 'accepted') {
    return res.render('invite-accept', {
      status: 'accepted',
      invite,
    });
  }

  // Don't auto-accept anymore if unauthenticated.
  // Just render the pending state so they can copy the token and login.
  res.render('invite-accept', {
    status: 'pending',
    invite,
  });
});

const acceptInviteFromDashboard = asyncHandler(async (req, res, next) => {
  try {
    const result = collaborationAcceptSchema.safeParse(req.body);

    if (!result.success) {
      return renderDashboard(req, res, { inviteAcceptError: result.error.issues[0].message });
    }

    const { inviteToken } = result.data;

    const userDoc = await User.findById(req.user.id).select('email').lean();
    if (!userDoc) {
      return renderDashboard(req, res, { inviteAcceptError: 'User not found.' });
    }

    // Atomically claim the invite: find a pending invite and mark it accepted in one operation
    const invite = await Invite.findOneAndUpdate(
      {
        token: inviteToken.trim(),
        status: 'pending',
        email: userDoc.email.trim().toLowerCase(), // Security fix: Verify email matches!
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      },
      { $set: { status: 'accepted', acceptedAt: new Date() } },
      { new: true }
    );

    if (!invite) {
      const existingInvite = await Invite.findOne({ token: inviteToken.trim() });
      if (!existingInvite) {
        return renderDashboard(req, res, { inviteAcceptError: 'No invitation found for that token.' });
      }
      if (
        existingInvite.status === "expired" ||
        (existingInvite.expiresAt && existingInvite.expiresAt < new Date())
      ) {
        return renderDashboard(req, res, { inviteAcceptError: "This invitation has expired." });
      }
      return renderDashboard(req, res, { inviteAcceptMessage: 'This invitation has already been accepted.' });
    }

    // Use $addToSet to prevent duplicate collaborator entries
    await User.findByIdAndUpdate(
      invite.inviter,
      { $addToSet: { collaborators: req.user.id } }
    );

    return renderDashboard(req, res, {
      inviteAcceptMessage: `Invitation for ${invite.email} was accepted successfully! You are now a collaborator.`,
    });
  } catch (error) {
    return renderDashboard(req, res, {
      inviteAcceptError: 'Unable to accept invite. Please try again later.',
    });
  }
});

module.exports = {
  getCreatorCrmPage,
  sendCollaboratorInvite,
  acceptInvite,
  acceptInviteFromDashboard,
};
