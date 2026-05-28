# Analytics Data Storage & Refresh System

## Overview
This module stores creator analytics history and periodically refreshes metrics using a scheduled worker.

---

## Database Schema

### `creators`
Stores creator profile information linked to a user.

| Field | Type | Description |
|---|---|---|
| userId | ObjectId | Reference to User |
| username | String | Creator's username |
| platform | String | instagram / youtube / twitter / tiktok |
| profileUrl | String | Profile URL |
| avatar | String | Avatar URL |
| lastRefreshedAt | Date | Last time analytics were refreshed |

### `analytics_snapshots`
Stores periodic snapshots of a creator's analytics.

| Field | Type | Description |
|---|---|---|
| creatorId | ObjectId | Reference to Creator |
| platform | String | Platform name |
| followers | Number | Follower count |
| following | Number | Following count |
| totalPosts | Number | Total posts |
| totalLikes | Number | Total likes |
| totalComments | Number | Total comments |
| totalViews | Number | Total views |
| engagementRate | Number | Engagement rate % |
| snapshotDate | Date | When snapshot was taken |

### `posts`
Stores individual post data for a creator.

| Field | Type | Description |
|---|---|---|
| creatorId | ObjectId | Reference to Creator |
| platform | String | Platform name |
| postId | String | Platform post ID |
| caption | String | Post caption |
| mediaUrl | String | Media URL |
| likes | Number | Like count |
| comments | Number | Comment count |
| views | Number | View count |
| postedAt | Date | When post was published |

### `engagement_history`
Tracks growth deltas between snapshots for trend analysis.

| Field | Type | Description |
|---|---|---|
| creatorId | ObjectId | Reference to Creator |
| snapshotId | ObjectId | Reference to AnalyticsSnapshot |
| date | Date | Date of record |
| followersGrowth | Number | Change in followers |
| likesGrowth | Number | Change in likes |
| commentsGrowth | Number | Change in comments |
| engagementRateDelta | Number | Change in engagement rate |

---

## API Endpoints

All endpoints are protected and require authentication.

### Get All Snapshots
```
GET /api/analytics/:creatorId/snapshots
```
Returns all analytics snapshots for a creator, newest first.

### Get Latest Snapshot
```
GET /api/analytics/:creatorId/snapshots/latest
```
Returns the most recent analytics snapshot for a creator.

### Get Engagement History
```
GET /api/analytics/:creatorId/engagement-history
```
Returns engagement growth history for a creator.

### Trigger Manual Refresh
```
POST /api/analytics/:creatorId/refresh
```
Manually triggers an analytics refresh for a creator.

---

## Refresh Worker
The worker runs automatically every 6 hours using `node-cron`.

- Fetches all creators from the database
- Captures a new analytics snapshot for each
- Computes growth deltas and saves to engagement history
- Updates `lastRefreshedAt` on the creator record

**Schedule:** `0 */6 * * *` (every 6 hours)

**Note:** Currently uses mock data. Replace the mock fetch in `workers/analyticsRefreshWorker.js` with real platform API calls (e.g. Instagram Graph API) when available.