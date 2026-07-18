# Dashboard Data Isolation & Security

This document outlines the security architecture and fix implemented to prevent data leakage between different creator accounts on the CreatorOS dashboard.

---

## 🔒 Security Fix: User-Agnostic Analytics Data Leak

### 1. The Vulnerability (Issue #422)
Previously, the dashboard analytics helper in `utils/dashboardHelper.js` fetched shortened URL metrics for all registered users on the entire platform. 
Specifically, the query was run without filtering by the logged-in creator:
```javascript
let urlsQuery = Url.find({}); // Aggregated all URLs on the platform
```
This allowed any authenticated user to view the total link counts, click metrics, top performing links, and aggregate click history of all other creators combined, representing a major privacy leak.

### 2. The Solution
We updated `getDashboardData` to enforce strict user-level isolation by filtering URL documents using the logged-in user's `_id` retrieved from `req.user`:
```javascript
const userId = userDoc ? userDoc._id : null;
let urlsQuery = userId ? Url.find({ userId }) : Url.find({ _id: null });
```
- If a valid `userDoc` is present, it returns only the URLs owned by that specific user.
- If no user context is available, it returns an empty query helper (`Url.find({ _id: null })`) instead of exposing all records.

### 3. Performance Optimization
To ensure database queries remain highly performant when filtering by user, an index has been added to the `userId` field of the `Url` schema in `model/url.js`:
```javascript
userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true, // <-- Ensures quick index-scans for user dashboard lookups
}
```

---

## 🧪 Verification & Testing
To guarantee that data isolation remains secure, a dedicated integration test has been added to `tests/dashboard.test.js`.

### Test Case: `Dashboard Data Isolation`
The test creates mock URLs for two different users (`User A` and `User B`), requests dashboard data for `User A`, and asserts that:
- `User B`'s URLs are **not** present in the aggregated results (`toBeUndefined()`).
- `User A`'s URLs are correctly resolved and aggregated.

### Running the Isolation Tests
To run the dashboard isolation tests:
```bash
npm test tests/dashboard.test.js
```
