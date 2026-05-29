const crypto = require('crypto');
const Invite = require('../model/invite');
const User = require('../model/user');
const services = require('../services.config');
const { sendInvitationEmail } = require('../utils/email');
const asyncHandler = require('../utils/asyncHandler');

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

const sendCollaboratorInvite = async (req, res, next) => {
  const { email, projectName, message } = req.body || {};

  if (!email) {
    return res.status(400).render('creator-crm', {
      user: buildAccountViewModel(await User.findById(req.user.id).select('name email').lean(), req.user),
      invites: await Invite.find({ inviter: req.user.id }).sort({ createdAt: -1 }).limit(12).lean(),
      success: null,
      error: 'Please provide an email address for the collaborator.',
    });
  }

  try {
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
      throw emailError;
    }

    const invites = await Invite.find({ inviter: req.user.id }).sort({ createdAt: -1 }).limit(12).lean();
    res.render('creator-crm', {
      user: buildAccountViewModel(userDoc, req.user),
      invites,
      success: `Invite sent successfully to ${invite.email}.`,
      error: null,
    });
  } catch (error) {
    console.error('Collaborator invite failed:', error);

    const userDoc = await User.findById(req.user.id).select('name email').lean();
    const invites = await Invite.find({ inviter: req.user.id }).sort({ createdAt: -1 }).limit(12).lean();

    res.status(500).render('creator-crm', {
      user: buildAccountViewModel(userDoc, req.user),
      invites,
      success: null,
      error: `Unable to send invite: ${error.message || 'Unexpected error'}`,
    });
  }
};

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

  return res.render('dashboard', {
    user: buildAccountViewModel(userDoc, req.user),
    services,
    inviteSummary,
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

const acceptInviteFromDashboard = async (req, res, next) => {
  const { inviteToken } = req.body || {};

  if (!inviteToken || !inviteToken.trim()) {
    return renderDashboard(req, res, { inviteAcceptError: 'Please paste a valid invite token.' });
  }

  try {
    const invite = await Invite.findOne({ token: inviteToken.trim() });

    if (!invite) {
      return renderDashboard(req, res, { inviteAcceptError: 'No invitation found for that token.' });
    }

    if (invite.status === 'accepted') {
      return renderDashboard(req, res, { inviteAcceptMessage: 'This invitation has already been accepted.' });
    }

    // Accept the invite
    invite.status = 'accepted';
    invite.acceptedAt = new Date();
    await invite.save();

    // Link the accounts: Add the current user to the inviter's collaborators
    const inviter = await User.findById(invite.inviter);
    if (inviter) {
      if (!inviter.collaborators) inviter.collaborators = [];
      
      // Ensure we don't push duplicates
      const isAlreadyCollaborator = inviter.collaborators.some(id => id.toString() === req.user.id.toString());
      if (!isAlreadyCollaborator) {
        inviter.collaborators.push(req.user.id);
        await inviter.save();
      }
    }

    return renderDashboard(req, res, {
      inviteAcceptMessage: `Invitation for ${invite.email} was accepted successfully! You are now a collaborator.`,
    });
  } catch (error) {
    console.error('Dashboard invite acceptance failed:', error);
    return renderDashboard(req, res, {
      inviteAcceptError: 'Unable to accept invite at this time. Please try again later.',
    });
  }
};

module.exports = {
  getCreatorCrmPage,
  sendCollaboratorInvite,
  acceptInvite,
  acceptInviteFromDashboard,
};
