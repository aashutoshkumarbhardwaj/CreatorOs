# CreatorOS Troubleshooting Guide

This document provides solutions for common issues encountered while setting up, running, or developing CreatorOS.

## 1. Authentication & Session Issues

### Users land on `/login` without errors after Google Sign-In
- **Symptom:** The Google OAuth flow completes, but you are redirected back to the login page and remain unauthenticated.
- **Cause:** Strict browsers (like Safari) or development environments (HTTP) may block the `SameSite=lax` session cookie when transitioning from a cross-site redirect (from Google) back to the application.
- **Solution:** 
  1. Ensure you access your local server via `http://localhost:3000` (cookies behave differently on `127.0.0.1`).
  2. If deploying to production, ensure HTTPS is enforced. 
  3. We've implemented an intermediary HTML client-side redirect in `handleGoogleCallback` to mitigate this across stricter browsers.

### API Requests return `403 Forbidden` (CSRF token mismatch)
- **Symptom:** When calling endpoints like `/api/urls/shorten` programmatically via cURL or an external integration, the server responds with a 403 error.
- **Cause:** Global CSRF validation block.
- **Solution:** As of recent patches, CSRF tokens are only required on form-based authentication routes (like `/login` or `/signup`). Programmatic access should authenticate using the `Authorization: Bearer <token>` header, which inherently protects against CSRF.

## 2. Platform & Background Workers

### Scheduled Content is marked "Published" but doesn't appear on socials
- **Symptom:** Items in the Content Scheduler change their status to `published` but no actual post was created.
- **Cause:** The `contentPublishWorker.js` executes the database transition but the underlying social provider integration might be mocked, failing, or missing configuration credentials.
- **Solution:** Verify that your platform API keys are correct in `.env`. 

### The Node.js Process Won't Exit Gracefully
- **Symptom:** When pressing `Ctrl+C` or stopping a Docker container, the Node.js process hangs or must be force-killed.
- **Cause:** A recurring timer or worker interval is keeping the event loop alive.
- **Solution:** Ensure all intervals (like the click cooldown sweep or background workers) call `.unref()` or are cleared properly upon receiving `SIGTERM`/`SIGINT`. (This was patched for the click cooldown tracker recently).

## 3. Email & Verification

### Users cannot verify their emails
- **Symptom:** Clicking the verification link redirects users to the login page, but their account remains unverified.
- **Cause:** The SMTP credentials in your `.env` are invalid, or you are testing in a non-production environment without mock configurations.
- **Solution:** Review `docs/EMAIL_VERIFICATION.md` to ensure your `.env` is properly populated with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`.

## 4. AI & Content Suggestions

### The Suggestions Page Returns Generic "Vibes"
- **Symptom:** Requesting an AI suggestion returns boilerplate hashtags and captions about "Vibes".
- **Cause:** `OPENAI_API_KEY` is missing or invalid in your `.env`.
- **Solution:** Configure a valid OpenAI key. If you wish to enable the fallback template for testing, ensure `USE_TEMPLATE_FALLBACK=true` is set. Otherwise, the tool will correctly throw an explicit failure.
