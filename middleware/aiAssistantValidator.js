const { z } = require("zod");

const chatSchema = z.object({
  prompt: z
    .string({ required_error: "Prompt is required" })
    .min(2, "Prompt must be at least 2 characters long")
    .max(2000, "Prompt must be less than 2000 characters"),
  platform: z
    .enum(["general", "instagram", "youtube", "twitter", "tiktok", "linkedin"])
    .optional()
    .default("general"),
  tone: z
    .enum(["energetic", "professional", "witty", "persuasive", "minimalist", "educational"])
    .optional()
    .default("energetic"),
  chatId: z.string().optional(),
});

const toolSchema = z.object({
  text: z
    .string({ required_error: "Text content is required for tool analysis" })
    .min(2, "Text must be at least 2 characters")
    .max(3000, "Text must be less than 3000 characters"),
  platform: z
    .enum(["general", "instagram", "youtube", "twitter", "tiktok", "linkedin"])
    .optional()
    .default("general"),
});

/**
 * Middleware validator for Chat API requests
 */
function validateChatRequest(req, res, next) {
  const result = chatSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.errors[0]?.message || "Invalid request payload",
      errors: result.error.errors,
    });
  }
  req.validatedBody = result.data;
  next();
}

/**
 * Middleware validator for AI Tool requests
 */
function validateToolRequest(req, res, next) {
  const result = toolSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.errors[0]?.message || "Invalid tool payload",
      errors: result.error.errors,
    });
  }
  req.validatedBody = result.data;
  next();
}

module.exports = {
  validateChatRequest,
  validateToolRequest,
};
