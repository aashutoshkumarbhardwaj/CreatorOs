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

/**
 * @function validate
 * @description Automatically generated JSDoc for validate
 * @returns {any}
 */
function validate(schema, viewName, buildLocals = () => ({})) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues?.[0]?.message || "Invalid request data";
      if (wantsHtml(req)) {
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
    signupValidator: validate(signupSchema, 'signup'),
    loginValidator: validate(loginSchema, 'login', () => ({
        googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
    }))
};
