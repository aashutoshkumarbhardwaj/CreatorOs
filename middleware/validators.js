const { z } = require('zod');
const { wantsHtml } = require('../utils/requestType');

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const shortenUrlSchema = z.object({
  redirectUrl: z.string().url('A valid HTTP or HTTPS URL is required'),
  title: z.string().optional(),
  customSlug: z.string().optional(),
  tag: z.string().optional(),
});

const updateQrColorsSchema = z.object({
  qrFgColor: z.string().optional(),
  qrBgColor: z.string().optional(),
});

const inviteCollaboratorSchema = z.object({
  email: z.string().email('Invalid email format'),
  projectName: z.string().optional(),
  message: z.string().optional(),
});

const generateSuggestionSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
});

/**
 * @function validate
 * @description Automatically generated JSDoc for validate
 * @returns {any}
 */
function validate(schema, viewName = null, buildLocals = () => ({})) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues?.[0]?.message || "Invalid request data";
      if (viewName && wantsHtml(req)) {
        return res.status(400).render(viewName, {
            ...buildLocals(req),
            error: message,
        });
      }
      return res.status(400).json({ success: false, message, error: message });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { 
    signupSchema, 
    loginSchema, 
    resendVerificationSchema,
    shortenUrlSchema,
    updateQrColorsSchema,
    inviteCollaboratorSchema,
    generateSuggestionSchema,
    signupValidator: validate(signupSchema, 'signup'),
    loginValidator: validate(loginSchema, 'login', () => ({
        googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
    })),
    resendVerificationValidator: validate(resendVerificationSchema, 'resend-verification'),
    shortenUrlValidator: validate(shortenUrlSchema),
    updateQrColorsValidator: validate(updateQrColorsSchema),
    inviteCollaboratorValidator: validate(inviteCollaboratorSchema),
    generateSuggestionValidator: validate(generateSuggestionSchema)
};
