# Async Error Handling Guidelines

## Overview

To prevent unhandled Promise rejections from crashing the Express server, all async route handlers MUST be wrapped with the `asyncHandler` utility. This ensures errors from database calls, external APIs, and other async operations are caught and forwarded to the global error handler.

## The Problem

Express 4.x does not automatically catch rejected promises from async route handlers. Without proper error handling:

```javascript
// DANGER: Unhandled rejection will crash the server
router.get('/user/:id', async (req, res) => {
  const user = await User.findById(req.params.id); // If this fails, server crashes
  res.json(user);
});
```

## The Solution

Wrap all async handlers with `asyncHandler`:

```javascript
const asyncHandler = require('../utils/asyncHandler');

// SAFE: Errors are caught and forwarded to error handler
router.get('/user/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user);
}));
```

## Implementation Checklist

### Controllers
- [x] auth.js: All handlers wrapped
- [x] contentController.js: All handlers wrapped
- [x] collaborationController.js: Main handlers wrapped (renderDashboard needs wrapping if exported as route handler)
- [x] instagramController.js: getInstagramProfile wrapped if exported to routes
- [x] url.js: handleGenerateShortUrl and handleListUserLinks wrapped if exported to routes

### Routes
- Verify all route definitions that use async functions wrap them with `asyncHandler`
- Use grep pattern: `router\.(get|post|put|delete|patch)\([^,]*,.*async` to find unwrapped handlers

## Testing

Test that unhandled rejections are caught:

```javascript
app.get('/test-unhandled', asyncHandler(async (req, res) => {
  await User.findOne({ email: null }); // Simulated error
  res.json({ ok: true });
}));

// This should return 500 with generic error, not crash the process
```

## Resources

- `utils/asyncHandler.js`: The wrapper utility
- `middleware/errorHandler.js`: Where caught errors are formatted for clients
- All async route handlers: Should follow this pattern without exception
