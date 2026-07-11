import subprocess

issues = [
    {
        "title": "feat(bio): Implement custom domain support for Smart Bio pages",
        "body": """## Description
Creators need the ability to map their custom domains (e.g., `links.mybrand.com`) to their CreatorOS Smart Bio page instead of using the default subdomain. This enhances brand professionalism.

### Acceptance Criteria
- [ ] Allow users to add a custom domain in the dashboard settings.
- [ ] Verify domain ownership using DNS records (TXT or CNAME).
- [ ] Update the routing logic to resolve the bio page based on the requested host.
- [ ] Handle SSL certificate generation (e.g., using Let's Encrypt / Caddy / Nginx dynamically if self-hosted).

### Type of Change
- [x] Feature
- [ ] Bug Fix
- [ ] Security Enhancement
- [ ] Refactoring
- [ ] Infrastructure

### Steps to Reproduce
1. Navigate to user settings in the dashboard.
2. Under "Domains", add a custom domain.
3. Verify DNS records and test the resolution.
4. Ensure the bio page loads correctly on the custom domain.

### Expected Behavior
A user should be able to serve their Smart Bio page from their own domain securely.
"""
    },
    {
        "title": "feat(analytics): Build link click heatmap visualization",
        "body": """## Description
To help creators understand their audience's behavior, we need a visual heatmap showing which links on their Smart Bio page get the most clicks over time.

### Acceptance Criteria
- [ ] Track click coordinates/link IDs in the backend.
- [ ] Create an API endpoint to aggregate click data over a specified date range.
- [ ] Implement a visual heatmap overlay on the bio page preview in the dashboard.
- [ ] Use a charting library (like Chart.js or D3) or custom CSS for the heatmap rendering.

### Type of Change
- [x] Feature
- [ ] Bug Fix
- [ ] UI/UX Improvement
- [ ] Performance Optimization

### Steps to Reproduce
1. Click on several links on a bio page.
2. Navigate to the Analytics Dashboard.
3. View the new "Heatmap" section.
4. Ensure the most clicked links appear "hotter" visually.

### Expected Behavior
Creators can instantly see which bio links are driving the most traffic visually.
"""
    },
    {
        "title": "feat(crm): Add sponsor contact database and pipeline board",
        "body": """## Description
The Creator CRM currently lacks a way to track active brand deals. We need a Kanban-style pipeline board (e.g., Pitching, Negotiating, Active, Completed) to track sponsorships.

### Acceptance Criteria
- [ ] Create Mongoose schemas for `Sponsor` and `BrandDeal`.
- [ ] Build API endpoints for CRUD operations on brand deals.
- [ ] Implement a drag-and-drop Kanban board UI using Vanilla JS / EJS.
- [ ] Allow adding custom notes and payout amounts for each deal.

### Type of Change
- [x] Feature
- [ ] Bug Fix
- [ ] Performance Optimization
- [ ] Refactoring

### Steps to Reproduce
1. Navigate to the CRM section.
2. Click "Add New Deal".
3. Move the deal across different columns (Pitching -> Negotiating).
4. Verify database updates upon moving.

### Expected Behavior
Creators have a fully functional Kanban board to track their sponsorship pipelines.
"""
    },
    {
        "title": "feat(automation): Integrate Instagram Graph API for DM keyword triggers",
        "body": """## Description
To support DM automation, we need to integrate with the Instagram Graph API to listen for specific keywords in comments/DMs and trigger automated replies.

### Acceptance Criteria
- [ ] Implement Facebook Login for Business to obtain Instagram Graph API tokens.
- [ ] Set up a webhook endpoint to receive incoming Instagram messages.
- [ ] Implement logic to match incoming text with user-defined keyword triggers.
- [ ] Send automated replies using the Instagram Graph API.

### Type of Change
- [x] Feature
- [ ] Integration
- [ ] Infrastructure
- [ ] Bug Fix

### Steps to Reproduce
1. Connect an Instagram Professional account in settings.
2. Set up a keyword trigger (e.g., "GUIDE").
3. Send a DM with the keyword from another account.
4. Verify the automated response is received.

### Expected Behavior
The system successfully replies to DMs containing specific keywords automatically.
"""
    },
    {
        "title": "feat(auth): Implement Google OAuth2.0 authentication",
        "body": """## Description
While we have the `passport-google-oauth20` package installed, the Google Login flow is not fully implemented on the frontend and backend. We need to complete this to reduce onboarding friction.

### Acceptance Criteria
- [ ] Configure the Passport Google strategy in `middleware/passport.js` or similar.
- [ ] Add the Google Login button to the signup and login pages (`view/auth/`).
- [ ] Ensure user accounts are created/linked properly in MongoDB.
- [ ] Handle session creation and redirect to the dashboard upon successful login.

### Type of Change
- [x] Feature
- [ ] Security Enhancement
- [ ] Bug Fix
- [ ] Refactoring

### Steps to Reproduce
1. Click "Continue with Google" on the login page.
2. Complete the Google consent screen.
3. Verify redirection to the dashboard and session persistence.

### Expected Behavior
Users can sign up and log in securely using their Google accounts.
"""
    },
    {
        "title": "bug(ui): Fix sidebar overlapping main content on mobile screens",
        "body": """## Description
On viewports smaller than 768px, the dashboard sidebar does not collapse, causing it to overlap the main content area and making the app unusable on mobile devices.

### Acceptance Criteria
- [ ] Implement a responsive hamburger menu for mobile views.
- [ ] Hide the sidebar by default on screens < 768px.
- [ ] Ensure smooth transition animations for opening/closing the sidebar.
- [ ] Verify Tailwind classes are used correctly for responsive design.

### Type of Change
- [ ] Feature
- [x] Bug Fix
- [x] UI/UX Improvement
- [ ] Performance Optimization

### Steps to Reproduce
1. Open the CreatorOS dashboard.
2. Resize the browser window to mobile width.
3. Observe the sidebar overlapping the main content.

### Expected Behavior
The sidebar should collapse into a toggleable hamburger menu on mobile devices.
"""
    },
    {
        "title": "perf(db): Optimize MongoDB queries for fetching user analytics",
        "body": """## Description
As users accumulate more link clicks and profile views, the `/api/analytics` endpoint is becoming slow due to full collection scans. We need proper indexing and query optimization.

### Acceptance Criteria
- [ ] Add compound indexes on `userId`, `linkId`, and `createdAt` in the analytics collections.
- [ ] Refactor Mongoose aggregation pipelines to leverage the new indexes.
- [ ] Implement pagination or time-bucketing for large datasets.
- [ ] Ensure query response times drop below 200ms for large profiles.

### Type of Change
- [ ] Feature
- [ ] Bug Fix
- [x] Performance Optimization
- [ ] Refactoring

### Steps to Reproduce
1. Seed the database with 100,000 mock click records for a single user.
2. Hit the analytics endpoint and measure response time.
3. Apply indexes and compare the new response time.

### Expected Behavior
Analytics data loads quickly even for high-traffic creators.
"""
    },
    {
        "title": "feat(ai): Integrate OpenAI for content generation suggestions",
        "body": """## Description
To power the "Content OS", we need to integrate the OpenAI API to help creators generate captions, video scripts, and post ideas based on brief prompts.

### Acceptance Criteria
- [ ] Set up the OpenAI Node.js SDK.
- [ ] Create an API endpoint `/api/ai/generate` that accepts a prompt and content type.
- [ ] Build a UI component in the Idea Bank to interface with this endpoint.
- [ ] Implement token limits and rate limiting to control OpenAI API costs.

### Type of Change
- [x] Feature
- [ ] Integration
- [ ] Performance Optimization
- [ ] UI/UX Improvement

### Steps to Reproduce
1. Navigate to the Content OS / Idea Bank.
2. Click "Generate with AI" and enter a topic.
3. Wait for the response and verify the generated text.

### Expected Behavior
Creators receive high-quality AI-generated content suggestions based on their input.
"""
    },
    {
        "title": "feat(queue): Implement background job processing with BullMQ for bulk emails",
        "body": """## Description
Sending emails synchronously blocks the Node.js event loop, causing delayed API responses. We need to offload email sending (e.g., welcome emails, CRM reminders) to background workers using BullMQ.

### Acceptance Criteria
- [ ] Configure a Redis connection for BullMQ.
- [ ] Create queues for `emailQueue` and define workers to process them.
- [ ] Refactor existing `nodemailer` usage to enqueue jobs instead of sending directly.
- [ ] Add error handling and retry mechanisms for failed jobs.

### Type of Change
- [x] Feature
- [ ] Bug Fix
- [x] Performance Optimization
- [x] Infrastructure

### Steps to Reproduce
1. Trigger an action that sends an email (e.g., signing up).
2. Verify the API responds immediately.
3. Check the Redis queue and worker logs to ensure the email is processed in the background.

### Expected Behavior
Email dispatching is non-blocking and highly reliable.
"""
    },
    {
        "title": "test(auth): Add comprehensive unit tests for JWT authentication middleware",
        "body": """## Description
Our `middleware/auth.js` currently lacks unit tests, which poses a security risk if changes accidentally introduce vulnerabilities. We need robust tests using Jest.

### Acceptance Criteria
- [ ] Write tests to verify valid JWT tokens allow access.
- [ ] Write tests to ensure expired or malformed tokens are rejected with a `401 Unauthorized`.
- [ ] Ensure missing headers are handled gracefully.
- [ ] Achieve 100% test coverage for the authentication middleware.

### Type of Change
- [ ] Feature
- [ ] Bug Fix
- [x] Testing
- [ ] Refactoring

### Steps to Reproduce
1. Run `npm run test`.
2. Ensure the new middleware tests pass and coverage is reported.

### Expected Behavior
All edge cases for JWT authentication are thoroughly tested and verified.
"""
    },
    {
        "title": "docs(api): Add Swagger OpenAPI specifications for public routes",
        "body": """## Description
To allow third-party integrations and make frontend development easier, we need to document our API endpoints using Swagger/OpenAPI.

### Acceptance Criteria
- [ ] Configure `swagger-jsdoc` and `swagger-ui-express`.
- [ ] Add JSDoc OpenAPI annotations to major routes (Auth, Bio, CRM, Analytics).
- [ ] Expose the documentation at `/api/docs`.
- [ ] Ensure request bodies, parameters, and responses are properly typed.

### Type of Change
- [ ] Feature
- [ ] Bug Fix
- [x] Documentation
- [ ] Refactoring

### Steps to Reproduce
1. Start the server.
2. Navigate to `/api/docs`.
3. Verify the interactive Swagger UI loads and endpoints can be tested.

### Expected Behavior
Developers can easily understand and test the CreatorOS API via Swagger.
"""
    },
    {
        "title": "feat(billing): Integrate Stripe checkout for Pro tier subscriptions",
        "body": """## Description
To support the "PRO" and "SCALE" pricing tiers, we need to integrate Stripe for handling recurring subscriptions and payment processing.

### Acceptance Criteria
- [ ] Set up the Stripe Node.js library.
- [ ] Create a webhook endpoint `/api/webhooks/stripe` to handle subscription events (e.g., `invoice.paid`, `customer.subscription.deleted`).
- [ ] Build a checkout UI flow that redirects to Stripe Checkout.
- [ ] Update the user model to reflect their current subscription status.

### Type of Change
- [x] Feature
- [ ] Integration
- [ ] Security Enhancement
- [ ] Bug Fix

### Steps to Reproduce
1. Navigate to Settings -> Billing.
2. Click "Upgrade to PRO".
3. Complete the mock Stripe checkout.
4. Verify the account is upgraded successfully.

### Expected Behavior
Users can easily upgrade their accounts via Stripe, and the system automatically updates their feature access.
"""
    },
    {
        "title": "sec(api): Implement Express rate limiting on auth endpoints to prevent brute-force",
        "body": """## Description
The login and password reset endpoints are currently vulnerable to brute-force and credential stuffing attacks. We must implement strict rate limiting.

### Acceptance Criteria
- [ ] Configure `express-rate-limit` using `rate-limit-mongo` or Redis as the store.
- [ ] Limit the `/api/auth/login` endpoint to 5 attempts per IP per 15 minutes.
- [ ] Limit the `/api/auth/forgot-password` endpoint to 3 attempts per IP per hour.
- [ ] Return a standard `429 Too Many Requests` response when limits are hit.

### Type of Change
- [ ] Feature
- [ ] Bug Fix
- [x] Security Enhancement
- [ ] Performance Optimization

### Steps to Reproduce
1. Attempt to log in with an incorrect password 6 times consecutively.
2. Verify the 6th attempt returns a 429 status code.
3. Wait 15 minutes and verify access is restored.

### Expected Behavior
Malicious actors cannot repeatedly guess passwords without being blocked.
"""
    }
]

for i, issue in enumerate(issues):
    print(f"Creating issue {i+1}: {issue['title']}")
    try:
        subprocess.run(["gh", "issue", "create", "--title", issue["title"], "--body", issue["body"]], check=True)
        print(f"Successfully created issue {i+1}")
    except subprocess.CalledProcessError as e:
        print(f"Failed to create issue {i+1}: {e}")
