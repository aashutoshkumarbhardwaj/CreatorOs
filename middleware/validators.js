const { z } = require('zod');
const { wantsHtml } = require('../utils/requestType');

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  allowUnverifiedLogin: z.string().optional(),
  remember: z.union([z.boolean(), z.string(), z.number()]).optional(),
});

// Guest contributor login creates a session without creator credentials.
const contributorLoginSchema = z.object({}).passthrough();

const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
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
  topic: z.string().trim().min(1, 'Topic is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  alias: z.string().min(1, 'Alias is required').max(50, 'Alias must be at most 50 characters').regex(/^[a-zA-Z0-9_-]+$/, 'Alias can only contain letters, numbers, hyphens and underscores').optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one profile field is required',
});

const objectIdParamSchema = z.object({
  creatorId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid creatorId'),
});

const shortIdParamSchema = z.object({
  shortId: z.string().min(1, 'Short ID is required'),
});

const contentOsItemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().max(2000).optional().or(z.literal('')),
  type: z.enum(['idea', 'script', 'post', 'template', 'draft']).optional(),
  status: z.enum(['idea', 'scripting', 'filming', 'editing', 'ready', 'scheduled', 'published']).optional(),
  platform: z.enum(['instagram', 'youtube', 'twitter', 'tiktok', 'linkedin', 'blog', 'general']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  folderId: z.string().optional().nullable().or(z.literal('')),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  scriptDetails: z.object({
    hook: z.string().optional(),
    body: z.string().optional(),
    cta: z.string().optional(),
    teleprompterNotes: z.string().optional(),
  }).optional(),
  mediaAssets: z.array(z.object({
    url: z.string(),
    type: z.string().optional(),
    name: z.string().optional(),
  })).optional(),
  scheduledAt: z.string().optional().nullable().or(z.literal('')),
  aiGenerated: z.boolean().optional(),
});

const contentOsFolderSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required').max(100, 'Folder name must be at most 100 characters'),
  color: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color').optional(),
  description: z.string().max(500).optional().or(z.literal('')),
});

const contentOsAiSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required'),
  mode: z.enum(['idea', 'hook', 'script', 'caption']).optional(),
  niche: z.string().optional(),
  platform: z.enum(['instagram', 'youtube', 'twitter', 'tiktok', 'linkedin', 'blog', 'general']).optional(),
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
    contributorLoginSchema,
    resendVerificationSchema,
    collaborationInviteSchema,
    collaborationAcceptSchema,
    urlShortenSchema,
    urlQRColorsSchema,
    suggestionSchema,
    updateProfileSchema,
    objectIdParamSchema,
    shortIdParamSchema,
    contentOsItemSchema,
    contentOsFolderSchema,
    contentOsAiSchema,
    validate,
    signupValidator: validate(signupSchema, 'body', 'signup'),
    loginValidator: validate(loginSchema, 'body', 'login', () => ({
        googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
    })),
    contributorLoginValidator: validate(contributorLoginSchema, 'body'),
    resendVerificationValidator: validate(resendVerificationSchema, 'body', 'resend-verification'),
    shortenUrlValidator: validate(urlShortenSchema, 'body'),
    updateQrColorsValidator: validate(urlQRColorsSchema, 'body'),
    inviteCollaboratorValidator: validate(collaborationInviteSchema, 'body'),
    generateSuggestionValidator: validate(suggestionSchema, 'body'),
    contentOsItemValidator: validate(contentOsItemSchema, 'body'),
    contentOsFolderValidator: validate(contentOsFolderSchema, 'body'),
    contentOsAiValidator: validate(contentOsAiSchema, 'body'),
};
