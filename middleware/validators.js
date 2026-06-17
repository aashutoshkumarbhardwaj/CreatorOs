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

const collaborationInviteSchema = z.object({
  email: z.string().email('Invalid email format'),
  projectName: z.string().optional(),
  message: z.string().optional(),
});

const collaborationAcceptSchema = z.object({
  inviteToken: z.string().min(1, 'Invite token is required'),
});

const urlShortenSchema = z.object({
  redirectUrl: z.string().url('A valid HTTP or HTTPS URL is required').optional(),
  url: z.string().url('A valid HTTP or HTTPS URL is required').optional(),
  title: z.string().optional(),
  customSlug: z.string()
    .regex(/^[a-z0-9-_]{3,32}$/, 'Custom slug must be 3–32 characters (letters, numbers, - or _).')
    .optional()
    .or(z.literal('')),
  campaignName: z.string().optional(),
  qrFgColor: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid qrFgColor hex value').optional(),
  qrBgColor: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid qrBgColor hex value').optional(),
  tag: z.enum(['active', 'social', 'campaign', 'general']).optional().or(z.literal('')),
}).refine(data => data.redirectUrl || data.url, {
  message: "A valid HTTP or HTTPS URL is required",
  path: ["redirectUrl"]
});

const urlQRColorsSchema = z.object({
  qrFgColor: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid qrFgColor hex value').optional(),
  qrBgColor: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid qrBgColor hex value').optional(),
});

const suggestionSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
});

const objectIdParamSchema = z.object({
  creatorId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid creatorId'),
});

const shortIdParamSchema = z.object({
  shortId: z.string().min(1, 'Short ID is required'),
});

function validate(schema, source = 'body', viewName, buildLocals = () => ({})) {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues?.[0]?.message || "Invalid request data";
      if (wantsHtml(req) && viewName) {
        return res.status(400).render(viewName, {
            ...buildLocals(req),
            error: message,
        });
      }
      return res.status(400).json({ success: false, message, error: message });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { 
    signupSchema, 
    loginSchema, 
    signupValidator: validate(signupSchema, 'body', 'signup'),
    loginValidator: validate(loginSchema, 'body', 'login', () => ({
        googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
    })),
    validate,
    collaborationInviteSchema,
    collaborationAcceptSchema,
    urlShortenSchema,
    urlQRColorsSchema,
    suggestionSchema,
    objectIdParamSchema,
    shortIdParamSchema
};
