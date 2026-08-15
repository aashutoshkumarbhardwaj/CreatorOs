# CreatorOS Authentication Architecture (`docs/AUTH.md`)

This document details the authentication architecture, security configuration, session management, and authorization rules for CreatorOS.

---

## 1. Architecture Overview

CreatorOS implements a stateless **JSON Web Token (JWT)** authentication mechanism as its primary identity system, coupled with an optional **Google OAuth 2.0** Single Sign-On (SSO) flow via Passport.js.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CreatorOS Auth Layer                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Primary Authentication               │ Optional SSO Integration             │
│ Custom JWT (jsonwebtoken)            │ Google OAuth 2.0 (passport-google)   │
│ Email + Hashed Password (bcryptjs)   │ Federated OAuth User Provisioning    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

> [!NOTE]
> **Active Providers**: Custom JWT Authentication and Passport.js Google OAuth.  
> **Legacy / Non-existent Providers**: External auth providers such as Clerk are **not** present in the dependency tree or server pipeline.

---

## 2. Environment Variables

| Variable | Scope | Status | Purpose / Description |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | Server | **Required** | Secret key used to sign and verify JWT tokens. |
| `SESSION_SECRET` | Server | **Required** | Secret key for Express session cookie signing and Passport session state. |
| `GOOGLE_CLIENT_ID` | Server | Optional | Google OAuth 2.0 Client ID for Google login button. |
| `GOOGLE_CLIENT_SECRET` | Server | Optional | Google OAuth 2.0 Client Secret for Google token exchange. |
| `GOOGLE_CALLBACK_URL` | Server | Optional | Authorized redirect URI (e.g. `http://localhost:3000/auth/google/callback`). |

---

## 3. Authentication Flows

### A. Local Email & Password Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as Web Client / Browser
    participant Router as Express Auth Router (/routes/auth.js)
    participant Controller as Auth Controller (/controller/auth.js)
    participant DB as MongoDB (User Model)

    User->>Client: Submit Login / Signup Form
    Client->>Router: POST /login (or /signup)
    Router->>Controller: Execute signup() or login()
    Controller->>DB: Query User & Verify Password (bcrypt)
    DB-->>Controller: User Record Verified
    Controller->>Controller: Generate JWT Token (jsonwebtoken)
    Controller-->>Client: Set httpOnly 'token' Cookie & Return Response JSON/Redirect
    Client->>User: Redirect to /dashboard
```

### B. Google OAuth 2.0 Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as Browser
    participant Express as CreatorOS Server
    participant Google as Google OAuth Server
    participant DB as MongoDB

    User->>Client: Click "Continue with Google"
    Client->>Express: GET /auth/google
    Express->>Google: Redirect to Google Accounts Consent Page
    Google-->>User: Present Consent Screen
    User->>Google: Approve Access
    Google->>Express: Redirect to GET /auth/google/callback?code=...
    Express->>Google: Exchange code for profile & token
    Google-->>Express: User Profile (Email, Name, Avatar)
    Express->>DB: resolveGoogleOAuthUser() (Find or Create User)
    DB-->>Express: Saved User Document
    Express->>Express: Sign JWT Token with JWT_SECRET
    Express-->>Client: Set httpOnly 'token' Cookie & Redirect to /dashboard
```

---

## 4. Token Resolution & Middleware Security

Authentication checks are handled primarily by [`middleware/auth.js`](file:///d:/GSSoC/CreatorOs/CreatorOs/middleware/auth.js).

### Token Resolution Strategy
1. **Cookie Priority**: Reads `req.cookies.token` (httpOnly cookie).
2. **Header Fallback**: Reads `Authorization: Bearer <token>` from HTTP headers.

### Security Guards
- **Password Modification Check**: If `user.passwordChangedAt` timestamp is greater than token `iat` (issued-at), the token is invalidated and user is prompted to log in again.
- **Email Verification Enforcement**: In production mode (`NODE_ENV=production`), unverified standard users (non-Google) are redirected to `/resend-verification`.

---

## 5. Role-Based Access Control (RBAC)

CreatorOS supports four primary roles enforced by dedicated middleware functions in [`middleware/auth.js`](file:///d:/GSSoC/CreatorOs/CreatorOs/middleware/auth.js):

| Role | Description | Permissions & Restrictions |
| :--- | :--- | :--- |
| `admin` | System Administrator | Full read & write access across all endpoints; passes `requireAdmin`. |
| `user` | Standard Registered User | Full access to user dashboard, scheduling, and personal resources. |
| `contributor` | Open Source Contributor | Access restricted from write operations by `preventContributorWrites`. |
| `guest_contributor` | Temporary Session Contributor | Validated against `ContributorSession` collection; restricted write access. |

### Available Middleware Functions
- `protect`: Verifies JWT validity and attaches decoded payload to `req.user`.
- `requireAdmin`: Enforces `req.user.role === 'admin'`.
- `preventContributorWrites`: Blocks write requests (`POST`, `PUT`, `DELETE`) for contributor roles.
- `redirectIfAuthenticated`: Utility middleware for landing/login pages to redirect active sessions to `/dashboard`.
