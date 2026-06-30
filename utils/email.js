const nodemailer = require('nodemailer');

const {
  EMAIL_SERVICE,
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  EMAIL_USER,
  EMAIL_PASSWORD,
  EMAIL_FROM_NAME,
  EMAIL_FROM,
  EMAIL_REPLY_TO,
} = process.env;

/**
 * @function createTransporter
 * @description Creates a nodemailer transporter object for sending emails.
 * @returns {any}
 */
function createTransporter() {
  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    throw new Error('Email transport is not configured. Set EMAIL_USER and EMAIL_PASSWORD.');
  }

  const transporterOptions = {
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  };

  if (EMAIL_SERVICE && !EMAIL_HOST) {
    transporterOptions.service = EMAIL_SERVICE;
  }

  if (EMAIL_HOST) {
    transporterOptions.host = EMAIL_HOST;
  }

  if (EMAIL_PORT) {
    transporterOptions.port = Number(EMAIL_PORT);
  }

  if (EMAIL_SECURE) {
    transporterOptions.secure = EMAIL_SECURE === 'true';
  } else if (EMAIL_PORT) {
    transporterOptions.secure = Number(EMAIL_PORT) === 465;
  }

  return nodemailer.createTransport(transporterOptions);
}

/**
 * @function sendInvitationEmail
 * @description Sends a collaboration invitation email to a specified recipient.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function sendInvitationEmail({ to, inviterName, projectName, inviteUrl, personalMessage }) {
  const transporter = createTransporter();
  const from = EMAIL_FROM || EMAIL_USER;
  const fromName = EMAIL_FROM_NAME || 'CreatorOS';
  const replyTo = EMAIL_REPLY_TO || from;
  const subject = `${inviterName} invited you to collaborate on ${projectName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2 style="color: #0f172a;">You’ve been invited to collaborate</h2>
      <p><strong>${inviterName}</strong> has invited you to collaborate on <strong>${projectName}</strong>.</p>
      ${personalMessage ? `<p><em>Message:</em> ${personalMessage}</p>` : ''}
      <p>Click the button below to accept the invitation and join the project.</p>
      <p style="text-align:center; margin: 32px 0;">
        <a href="${inviteUrl}" style="display:inline-block; padding:14px 24px; background:#22d3ee; color:#0f172a; text-decoration:none; border-radius:999px; font-weight:700;">Accept Invitation</a>
      </p>
      <p>If the button does not work, paste this URL into your browser:</p>
      <p><a href="${inviteUrl}" style="color:#2563eb;">${inviteUrl}</a></p>
      <p>Thanks,<br />CreatorOS Team</p>
    </div>
  `;

  const text = `${inviterName} invited you to collaborate on ${projectName}.

Accept here: ${inviteUrl}

${personalMessage ? `Message:
${personalMessage}

` : ''}
If the link does not work, paste it into your browser.`;

  return transporter.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    replyTo,
    subject,
    text,
    html,
  });
}

/**
 * @function sendVerificationEmail
 * @description Sends an email containing a verification link for new user registration.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */
async function sendVerificationEmail({ to, verificationLink, userName }) {
  const transporter = createTransporter();
  const from = EMAIL_FROM || EMAIL_USER;
  const fromName = EMAIL_FROM_NAME || 'CreatorOS';
  const replyTo = EMAIL_REPLY_TO || from;
  const subject = 'Verify Your CreatorOS Account';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2 style="color: #0f172a;">Verify Your Email Address</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>Welcome to CreatorOS! Please verify your email address to activate your account.</p>
      <p style="text-align:center; margin: 32px 0;">
        <a href="${verificationLink}" style="display:inline-block; padding:14px 24px; background:#22d3ee; color:#0f172a; text-decoration:none; border-radius:999px; font-weight:700;">Verify Email Address</a>
      </p>
      <p style="color:#666; font-size:14px;">This link will expire in 24 hours. If you did not create this account, you can ignore this email.</p>
      <p style="color:#666; font-size:14px;">If the button does not work, paste this URL into your browser:</p>
      <p style="color:#2563eb; word-break:break-all;"><a href="${verificationLink}" style="color:#2563eb;">${verificationLink}</a></p>
      <p>Best regards,<br />CreatorOS Team</p>
    </div>
  `;

  const text = `Welcome to CreatorOS! 

Please verify your email address by clicking this link:
${verificationLink}

This link will expire in 24 hours.

If you did not create this account, you can ignore this email.

Best regards,
CreatorOS Team`;

  return transporter.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    replyTo,
    subject,
    text,
    html,
  });
}

async function sendPasswordResetEmail({ to, resetLink, userName }) {
  const transporter = createTransporter();
  const from = EMAIL_FROM || EMAIL_USER;
  const fromName = EMAIL_FROM_NAME || 'CreatorOS';
  const replyTo = EMAIL_REPLY_TO || from;
  const subject = 'Reset Your CreatorOS Password';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2 style="color: #0f172a;">Reset Your Password</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>We received a request to reset your CreatorOS password. Click the button below to set a new password.</p>
      <p style="text-align:center; margin: 32px 0;">
        <a href="${resetLink}" style="display:inline-block; padding:14px 24px; background:#22d3ee; color:#0f172a; text-decoration:none; border-radius:999px; font-weight:700;">Reset Password</a>
      </p>
      <p style="color:#666; font-size:14px;">This link will expire in 15 minutes. If you did not request a password reset, you can ignore this email.</p>
      <p style="color:#666; font-size:14px;">If the button does not work, paste this URL into your browser:</p>
      <p style="color:#2563eb; word-break:break-all;"><a href="${resetLink}" style="color:#2563eb;">${resetLink}</a></p>
      <p>Best regards,<br />CreatorOS Team</p>
    </div>
  `;

  const text = `Hi ${userName || 'there'},

We received a request to reset your CreatorOS password. Click the link below to set a new password:

${resetLink}

This link will expire in 15 minutes.

If you did not request a password reset, you can ignore this email.

Best regards,
CreatorOS Team`;

  return transporter.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    replyTo,
    subject,
    text,
    html,
  });
}

module.exports = {
  sendInvitationEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
