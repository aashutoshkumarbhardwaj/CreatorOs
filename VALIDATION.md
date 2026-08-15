# CreatorOS Input Validation & Sanitization Architecture

This document details the input validation, sanitization, and security layer implemented across Express route controllers in CreatorOS using `express-validator`.

## Overview & Security Goals

1. **Input Validation**: All incoming requests that accept user payload data (profile metadata, CRM deals, brand details, invoice payloads, meeting bookings, content items, and DM triggers) are validated against strict type, format, length, and enum constraints.
2. **Input Sanitization**: String inputs are trimmed and HTML-escaped by default (`.trim()`, `.escape()`) to eliminate Stored XSS vectors.
3. **URL Protocol Restriction**: Bio links, websites, and action URLs enforce standard `http://` or `https://` protocols (`isURL({ protocols: ['http', 'https'], require_protocol: true })`), systematically blocking malicious `javascript:` URI schemes.
4. **NoSQL Query Injection Prevention**: Search and filtering query parameters (`q`, `stage`, `category`, `status`, `type`, `platform`, `priority`) pass through `sanitizeNoSqlQuery` middleware to prevent object operators (e.g. `{ $gt: "" }`) from manipulating MongoDB query filters.
5. **EJS Output Encoding Audit**: All EJS template dynamic string interpolations use escaped `<%= ... %>` tags rather than raw `<%- ... %>` tags (reserving `<%-` exclusively for partial includes and safe static SVGs).

---

## Standardized Error Response Format

Validation failures automatically trigger standard responses based on content negotiation:

### API Requests (JSON Output - HTTP 422 Unprocessable Entity)
```json
{
  "success": false,
  "message": "A valid http/https URL is required",
  "errors": [
    {
      "field": "url",
      "message": "A valid http/https URL is required",
      "value": "javascript:alert(1)"
    }
  ]
}
```

### HTML Views (Form Output - HTTP 400 Bad Request)
Renders the corresponding EJS view template with the `error` message and `errors` array populated.

---

## Module Schemas & Validation Rules

### 1. Creator CRM (`middleware/validators/creatorCrmValidator.js`)

| Endpoint | Middleware | Validated / Sanitized Fields & Rules |
|---|---|---|
| `GET /api/crm/data` | `validateCrmQuery` | Sanitizes `q`, `stage`, `category`, `status` query parameters to prevent NoSQL query operator injection. |
| `POST/PUT /api/crm/brands` | `validateBrand` | `companyName` (required, max 150, escaped), `contactEmail` (isEmail, normalized), `website` (http/https URL), `status` (enum), `notes` (max 2000, escaped). |
| `POST/PUT /api/crm/deals` | `validateDeal` | `dealName` (required, max 200, escaped), `amount` (float >= 0), `stage` (enum), `contactEmail` (isEmail). |
| `POST/PUT /api/crm/invoices` | `validateInvoice` | `invoiceName` (max 200, escaped), `amount` (float >= 0), `status` (enum), `dueDate` (ISO8601). |
| `PUT /api/crm/media-kit` | `validateMediaKit` | `displayName` (max 100, escaped), `bio` (max 1000, escaped). |

### 2. Smart Notifications (`middleware/validators/smartNotificationValidator.js`)

| Endpoint | Middleware | Validated / Sanitized Fields & Rules |
|---|---|---|
| `PUT /api/notifications/preferences` | `validatePreferences` | `frequency` (enum: instant, daily_digest, weekly_summary), `channels` (booleans for email, inApp, push), `categories` (array). |
| `POST /api/notifications` | `validateCreateNotification` | `title` (required, max 150, escaped), `message` (required, max 1000, escaped), `priority` (enum: low, medium, high, urgent), `actionUrl` (http/https URL). |

### 3. Meetings & Bookings (`middleware/validators/meetingValidator.js`)

| Endpoint | Middleware | Validated / Sanitized Fields & Rules |
|---|---|---|
| `POST/PUT /api/meetings/event-types` | `validateEventType` | `title` (required, max 150, escaped), `slug` (alphanumeric/hyphen), `duration` (integer 1-1440), `price` (float >= 0), `description` (max 2000, escaped). |
| `POST /api/public/meetings/:alias/:slug/book` | `validateCreateBooking` | `guestName` (required, max 100, escaped), `guestEmail` (required, isEmail, normalized), `guestNotes` (max 1000, escaped), `slotTime` (required, ISO8601 date). |

### 4. Creator Bio & Profile (`middleware/validators/creatorBioValidator.js`)

| Endpoint | Middleware | Validated / Sanitized Fields & Rules |
|---|---|---|
| `POST /api/bio/links` | `validateBioLink` | `url` (required, isURL with mandatory http/https protocol), `title` (required, 1-100 chars, escaped), `description` (max 500, escaped). |
| `PUT /api/settings/profile` | `validateProfile` | `name` (max 100, escaped), `alias` (max 50, alphanumeric/hyphen/underscore), `bio` (max 500, escaped). |

### 5. Content OS (`middleware/validators/contentOsValidator.js`)

| Endpoint | Middleware | Validated / Sanitized Fields & Rules |
|---|---|---|
| `POST/PUT /api/content/items` | `validateContentItem` | `title` (required, max 200, escaped), `description` (max 2000, escaped), `type` (enum), `status` (enum), `platform` (enum), `priority` (enum). |
| `POST/PUT /api/content/folders` | `validateContentFolder` | `name` (required, max 100, escaped), `color` (hex regex), `description` (max 500, escaped). |
| `POST /api/content/ai/generate` | `validateAiPrompt` | `prompt` (required, max 2000, escaped), `mode` (enum), `platform` (enum). |

### 6. Instagram DM Automation (`middleware/validators/instagramValidator.js`)

| Endpoint | Middleware | Validated / Sanitized Fields & Rules |
|---|---|---|
| `POST /api/instagram/triggers` | `validateDmTrigger` | `keyword` (required, max 100, escaped), `responseType` (enum: text, link, media), `responseText` (required, max 1000, escaped), `isActive` (boolean). |

---

## Unit Testing

All validator middleware components are tested via dedicated Jest test suites located in `tests/middleware/`:
- `tests/middleware/creatorCrmValidator.test.js`
- `tests/middleware/smartNotificationValidator.test.js`
- `tests/middleware/meetingValidator.test.js`
- `tests/middleware/creatorBioValidator.test.js`
- `tests/middleware/instagramValidator.test.js`
- `tests/middleware/contentOsValidator.test.js`

To run validation unit tests:
```bash
npx jest tests/middleware/
```
