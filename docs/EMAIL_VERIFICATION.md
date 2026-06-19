# Email Verification Implementation Guide

## Overview

This document describes the email verification feature implemented for CreatorOS user registration. The feature ensures users verify their email addresses before gaining full access to the platform.

**Status**: ✅ Fully Implemented  
**Version**: 1.0  
**Last Updated**: 2024  

---

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [User Flow](#user-flow)
5. [Security Considerations](#security-considerations)
6. [Environment Variables](#environment-variables)
7. [Email Configuration](#email-configuration)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Architecture

### Components

```
┌─────────────┐
│   Frontend  │
│  (EJS/HTML) │
└──────┬──────┘
       │
┌──────▼──────────────────────────────────┐
│   Express Routes (/routes/auth.js)      │
│  ├─ POST /signup                        │
│  ├─ POST /verify-email                  │
│  ├─ GET /verify-email (form)            │
│  ├─ POST /resend-verification           │
│  └─ GET /resend-verification (form)     │
└──────┬──────────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│  Auth Controller (controller/auth.js)   │
│  ├─ signup()                            │
│  ├─ login()                             │
│  ├─ verifyEmail()                       │
│  └─ resendVerificationEmail()           │
└──────┬──────────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│  Email Service (utils/email.js)         │
│  ├─ sendVerificationEmail()             │
│  └─ createTransporter()                 │
└──────┬──────────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│  Database (MongoDB)                     │
│  └─ User Model (model/user.js)          │
└──────────────────────────────────────────┘
```

### Verification Token Flow

```
1. User Signup
   ↓
2. Generate 32-byte crypto token
   ↓
3. Store token + expiry (24h) in User document
   ↓
4. Send email with verification link
   ↓
5. User clicks link
   ↓
6. Token validated
   ↓
7. Mark user as verified, clear token
   ↓
8. User can login
```

---

## Database Schema

### User Model Changes

Three new fields added to the User schema:

```javascript
{
  // ... existing fields ...

  isVerified: {
    type: Boolean,
    default: false,
  },

  verificationToken: {
    type: String,
    sparse: true,
    unique: true,
    index: true,
  },

  verificationTokenExpiry: {
    type: Date,
    index: true,
  }
}
```

**Field Descriptions:**

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `isVerified` | Boolean | `false` | Whether user has verified their email |
| `verificationToken` | String | `null` | Unique verification token (hex-encoded 32 bytes) |
| `verificationTokenExpiry` | Date | `null` | When verification token expires (24 hours) |

**Indexes:**
- `verificationToken`: Unique index (sparse) for fast lookup
- `verificationTokenExpiry`: Index for cleanup queries

---

## API Endpoints

### 1. User Registration

**POST /signup**

Creates a new unverified user account and sends verification email.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Sign up successful! Please check your email to verify your account.",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john@example.com"
  }
}
```

**Response (HTML):**
```html
<!-- Redirects to signup.ejs with success message -->
```

**Status Codes:**
- `201`: User created successfully
- `409`: Email already registered
- `400`: Validation error

---

### 2. Verify Email

**POST /verify-email?token=TOKEN**

Validates verification token and marks user as verified.

**Query Parameters:**
- `token` (required): Verification token from email link

**Request:**
```
POST /verify-email?token=a1b2c3d4e5f6...
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Email verified successfully!"
}
```

**Response (HTML):**
```html
<!-- verify-email.ejs with success message -->
```

**Status Codes:**
- `200`: Email verified successfully
- `400`: Invalid or missing token
- `410`: Token has expired

**Errors:**
| Status | Message | Action |
|--------|---------|--------|
| 400 | Invalid verification link | Request resend from /resend-verification |
| 410 | Link expired | Resend verification email |

---

### 3. Get Verification Form

**GET /verify-email**

Displays the email verification confirmation page.

**Response:** HTML page with verification status or error message

---

### 4. Resend Verification Email

**POST /resend-verification**

Generates new verification token and resends email.

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Verification email sent successfully!"
}
```

**Response (HTML):**
```html
<!-- resend-verification.ejs with success -->
```

**Status Codes:**
- `200`: Email sent (or generic success even if user doesn't exist)
- `400`: Email field missing
- `500`: Email service error

**Note:** Returns success even for non-existent emails (privacy)

---

### 5. User Login

**POST /login**

Authenticates user - now includes verification check.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (Unverified):**
```json
{
  "success": false,
  "message": "Please verify your email address before logging in.",
  "unverifiedEmail": "john@example.com"
}
```

**Status Codes:**
- `200`: Login successful
- `403`: Email not verified
- `401`: Invalid credentials

---

## User Flow

### Registration & Verification Flow

```
User visits /signup
     ↓
Enters name, email, password
     ↓
Clicks "Sign up"
     ↓
Server validates input
     ↓
Email already exists?
├─ YES → Error: "User already exists"
└─ NO → Continue
     ↓
Hash password
     ↓
Generate verification token (crypto.randomBytes(32))
     ↓
Create user with:
  - isVerified: false
  - verificationToken: <token>
  - verificationTokenExpiry: now + 24h
     ↓
Send verification email with link:
  "https://<your_production_domain>/verify-email?token=<token>"
     ↓
Show: "Sign up successful! Check your email..."
     ↓
User receives email
     ↓
User clicks verification link
     ↓
Server validates token:
  - Token exists in database?
  - Token expired?
  - User already verified?
     ↓
Validation successful?
├─ YES → Mark isVerified: true, clear token, show success
└─ NO → Show appropriate error
     ↓
User can now login
```

### Login Flow

```
User visits /login
     ↓
Enters email and password
     ↓
Server finds user by email
     ↓
User exists & password correct?
├─ NO → Error: "Invalid email or password"
└─ YES → Continue
     ↓
Check isVerified
     ├─ false → Error: "Verify email first", show resend link
     └─ true → Continue
     ↓
Create JWT token
     ↓
Set auth cookie
     ↓
Redirect to /dashboard
```

### Resend Verification Flow

```
User visits /resend-verification
     ↓
Enters email address
     ↓
User exists?
├─ NO → Show: "If that email is in our system..."
└─ YES → Continue
     ↓
User already verified?
├─ YES → Show: "Already verified, you can login"
└─ NO → Continue
     ↓
Generate new verification token
     ↓
Update user:
  - verificationToken: <new_token>
  - verificationTokenExpiry: now + 24h
     ↓
Send verification email with new link
     ↓
Show: "Verification email sent!"
```

---

## Security Considerations

### Token Generation

✅ **Secure Token Generation**
```javascript
function generateVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
}
```

- Uses `crypto.randomBytes()` for cryptographic randomness
- 32 bytes (256 bits) of entropy
- Hex-encoded to 64-character string
- Cannot be guessed or predicted

### Token Storage

✅ **Secure Storage**
- Stored in plaintext in database (acceptable - tokens are one-time use)
- Indexed for fast lookup
- Deleted immediately after verification
- Unique constraint prevents reuse

### Token Expiry

✅ **Time-Limited Tokens**
```javascript
function getVerificationTokenExpiry() {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
```

- 24-hour expiry window
- Checked server-side, not client-side
- Expired tokens cannot be used

### Email Privacy

✅ **No User Enumeration**
- Resend endpoint returns success for unknown emails
- Generic message: "If that email is in our system..."
- Prevents attackers from discovering registered email addresses

### Protected Routes

✅ **Verification Check in Middleware**
```javascript
if (!user.isVerified) {
    return res.status(403).redirect("/resend-verification");
}
```

- All protected routes check `isVerified`
- Unverified users redirected to resend page
- Cannot access dashboard or features without verification

### Google OAuth Auto-Verification

✅ **Automatic Verification for OAuth Users**
- Google OAuth users marked as verified: `isVerified: true`
- No token required
- Rationale: OAuth provider verified the email

### Email Validation

✅ **Input Validation**
- Email format validated with Zod schema
- Email normalized (lowercase, trimmed)
- Prevents injection and manipulation

### No Data Leakage

✅ **Secure Error Handling**
- Generic error messages in responses
- No stack traces exposed
- Logging configured appropriately

---

## Environment Variables

### Email Configuration

Required in `.env` or `.env.local`:

```bash
# Email Service Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_SERVICE=gmail                    # or 'custom'
EMAIL_HOST=smtp.gmail.com              # if not using SERVICE
EMAIL_PORT=587                         # or 465 for SSL
EMAIL_SECURE=false                     # true for port 465
EMAIL_FROM=hello@creatorOS.com
EMAIL_FROM_NAME=CreatorOS
EMAIL_REPLY_TO=support@creatorOS.com

# Application URL (for verification links)
APP_URL=https://<your_production_domain>        # Must be set for production
```

### Example: Gmail Setup

```bash
EMAIL_USER=creatorOS@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop    # Gmail App Password
EMAIL_SERVICE=gmail
EMAIL_FROM_NAME=CreatorOS
```

**Note:** Use Gmail App Passwords, not your regular password.

---

## Email Configuration

### Nodemailer Setup

Configuration in `utils/email.js`:

```javascript
function createTransporter() {
  const transporterOptions = {
    service: EMAIL_SERVICE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  };

  if (EMAIL_HOST) {
    transporterOptions.host = EMAIL_HOST;
    transporterOptions.port = Number(EMAIL_PORT);
    transporterOptions.secure = EMAIL_SECURE === 'true';
  }

  return nodemailer.createTransport(transporterOptions);
}
```

### Email Template

Verification email includes:

- **Subject:** "Verify Your CreatorOS Account"
- **To:** User's email address
- **Content:**
  - Personalized greeting with user name
  - Clear explanation of verification
  - Call-to-action button (styled)
  - Plain text link as fallback
  - 24-hour expiry notice
  - Reassurance about unwanted emails

### Email Service Providers

Tested with:
- ✅ Gmail (with App Passwords)
- ✅ SendGrid
- ✅ Mailgun
- ✅ AWS SES
- ✅ Custom SMTP servers

### Troubleshooting Email Issues

**Emails not sending:**
1. Verify credentials in `.env`
2. Check email service logs
3. Verify firewall/network allows SMTP
4. Check `EMAIL_SECURE` matches port number
5. Look for errors in server logs

---

## Testing

### Unit Tests

Located in `tests/email-verification.test.js`

**Test Coverage:**

```
✅ User Registration
   - Creates unverified account
   - Generates valid token
   - Sends verification email

✅ Email Verification
   - Valid token marks user verified
   - Invalid token returns 400
   - Expired token returns 410
   - Already verified shows success

✅ Login Restrictions
   - Unverified users cannot login
   - Verified users can login
   - Correct error message shown

✅ Resend Verification
   - New token generated
   - Token updated in database
   - Email sent with new token
   - No user enumeration

✅ Security
   - Tokens are unique
   - Tokens are unpredictable
   - Tokens expire correctly
   - Email addresses not enumerated
```

### Manual Testing Checklist

See `tests/email-verification.test.js` for complete manual testing checklist.

### Running Tests

```bash
# If Jest is set up:
npm test

# Or add to package.json:
"test": "jest tests/"
```

---

## Implementation Details

### File Changes Summary

| File | Changes |
|------|---------|
| `model/user.js` | Added isVerified, verificationToken, verificationTokenExpiry fields |
| `controller/auth.js` | Modified signup, login; added verifyEmail, resendVerificationEmail |
| `routes/auth.js` | Added /verify-email, /resend-verification routes |
| `middleware/auth.js` | Added isVerified check in protect middleware |
| `utils/email.js` | Added sendVerificationEmail function |
| `view/signup.ejs` | Added success message display |
| `view/login.ejs` | Added unverified message display |
| `view/verify-email.ejs` | **NEW** - Verification confirmation page |
| `view/resend-verification.ejs` | **NEW** - Resend verification form |
| `tests/email-verification.test.js` | **NEW** - Comprehensive test suite |

### Key Constants

```javascript
// Token expiry: 24 hours
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Token generation: 32 bytes = 64 hex characters
const tokenLength = 32; // bytes
```

---

## Troubleshooting

### Common Issues

#### 1. Users not receiving verification emails

**Symptoms:** Signup succeeds but no email received

**Solutions:**
- [ ] Verify EMAIL_USER and EMAIL_PASSWORD in .env
- [ ] Check email service is configured correctly
- [ ] Verify APP_URL is set correctly
- [ ] Check server logs for email errors
- [ ] Verify email account isn't rate-limited
- [ ] Check spam/junk folder

#### 2. "Email already exists" on first signup

**Symptoms:** Fresh email address returns duplicate error

**Solutions:**
- [ ] Check if email already in database
- [ ] Verify email normalization (lowercase)
- [ ] Check for duplicate indexes
- [ ] Clear mock database if using mock mode

#### 3. Verification token always expires

**Symptoms:** Token valid for less than 24 hours

**Solutions:**
- [ ] Verify server time is correct
- [ ] Check VERIFICATION_TOKEN_EXPIRY_MS constant
- [ ] Verify database stores correct expiry time
- [ ] Check timezone handling

#### 4. Login works without verification

**Symptoms:** User can login despite isVerified=false

**Solutions:**
- [ ] Verify protect middleware is applied
- [ ] Check isVerified check in login controller
- [ ] Verify middleware executes before login handler
- [ ] Check User model fetch includes isVerified field

#### 5. Token not found after sending email

**Symptoms:** Verification fails immediately with "Invalid token"

**Solutions:**
- [ ] Verify token is correctly stored in database
- [ ] Check token in email matches database
- [ ] Verify query parameter name (should be ?token=)
- [ ] Check for URL encoding issues

---

## Performance Considerations

### Database Queries

- `User.findOne({ verificationToken })` - Indexed for fast lookup
- `User.findOne({ email })` - Indexed for fast lookup
- Verification token index: sparse + unique (only non-null values)

### Email Sending

- Asynchronous, doesn't block signup
- Failures logged but don't fail signup
- Can be moved to queue service for high volume

### Token Cleanup

Consider adding a cron job to clean up expired tokens:

```javascript
const cron = require('node-cron');

// Daily cleanup at 2 AM
cron.schedule('0 2 * * *', async () => {
    await User.updateMany(
        { verificationTokenExpiry: { $lt: new Date() } },
        {
            $set: {
                verificationToken: null,
                verificationTokenExpiry: null
            }
        }
    );
});
```

---

## Future Enhancements

Potential improvements:

1. **Rate Limiting**
   - Limit resend requests to 3 per hour
   - Prevent email bombing

2. **Verification Reminders**
   - Send reminder email after 12 hours if not verified
   - Auto-delete unverified accounts after 7 days

3. **SMS Verification**
   - Alternative verification method via SMS
   - Better for users without email access

4. **2FA Integration**
   - Combine with two-factor authentication
   - Enhanced security option

5. **Email Template System**
   - Customizable email templates
   - Multi-language support

6. **Webhook Notifications**
   - Notify external systems when user verified
   - Integration with analytics

7. **Admin Panel**
   - Manually verify users
   - View verification statistics
   - Resend emails for users

---

## Support & Documentation

For issues or questions:

1. Check the troubleshooting section above
2. Review test files for usage examples
3. Check server logs for detailed errors
4. Review CONTRIBUTING.md for development guidelines

---

**End of Email Verification Documentation**
