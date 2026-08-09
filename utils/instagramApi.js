const PROFILE_FIELDS = 'followers_count,follows_count,media_count,id,username';
const MEDIA_PAGE_SIZE = 50;
const MAX_MEDIA_PAGES = 40; // safety cap: up to 2000 media items

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const errBody = await response.text();
        const error = new Error(`Instagram API Error: ${response.status} - ${errBody}`);
        error.status = response.status;
        error.body = errBody;
        throw error;
    }
    return response.json();
}

function sumMediaEngagement(mediaList) {
    let totalLikes = 0;
    let totalComments = 0;
    let hasCounts = false;

    for (const item of mediaList) {
        if (typeof item.like_count === 'number' || typeof item.comments_count === 'number') {
            totalLikes += item.like_count || 0;
            totalComments += item.comments_count || 0;
            hasCounts = true;
        }
    }

    return { totalLikes, totalComments, hasCounts };
}

async function fetchAllMediaEngagement(platformId, accessToken) {
    let url =
        `https://graph.instagram.com/${platformId}/media` +
        `?fields=like_count,comments_count&limit=${MEDIA_PAGE_SIZE}&access_token=${accessToken}`;

    let totalLikes = 0;
    let totalComments = 0;
    let hasCounts = false;
    let pages = 0;

    while (url && pages < MAX_MEDIA_PAGES) {
        const page = await fetchJson(url);
        const mediaList = Array.isArray(page.data) ? page.data : [];
        const pageSums = sumMediaEngagement(mediaList);
        totalLikes += pageSums.totalLikes;
        totalComments += pageSums.totalComments;
        hasCounts = hasCounts || pageSums.hasCounts;
        url = page.paging?.next || null;
        pages += 1;
    }

    return { totalLikes, totalComments, engagementAvailable: hasCounts };
}

const fetchInstagramAnalytics = async (creator) => {
    if (creator.platform !== 'instagram' || !creator.accessToken) {
        throw new Error('Creator does not have a valid Instagram access token or is not on the Instagram platform.');
    }

    try {
        const platformId = creator.platformId || 'me';
        const accessToken = creator.accessToken;

        // Always fetch profile metrics first so a media-permission failure can
        // still return useful follower/following/post counts.
        const data = await fetchJson(
            `https://graph.instagram.com/${platformId}?fields=${PROFILE_FIELDS}&access_token=${accessToken}`
        );

        let totalLikes = 0;
        let totalComments = 0;
        let engagementAvailable = false;

        try {
            const engagement = await fetchAllMediaEngagement(platformId, accessToken);
            totalLikes = engagement.totalLikes;
            totalComments = engagement.totalComments;
            engagementAvailable = engagement.engagementAvailable;
        } catch (mediaError) {
            // Missing permission / unsupported field (or any media failure):
            // keep profile metrics and mark engagement unavailable.
            console.warn(
                `[InstagramAPI] Media engagement unavailable for ${creator._id}:`,
                mediaError.message
            );
            engagementAvailable = false;
            totalLikes = 0;
            totalComments = 0;
        }

        const totalPosts = data.media_count || 0;
        const followers = data.followers_count || 0;
        const following = data.follows_count || 0;

        const engagementRate = (engagementAvailable && followers > 0)
            ? parseFloat((((totalLikes + totalComments) / followers) * 100).toFixed(2))
            : 0;

        return {
            followers,
            following,
            totalPosts,
            totalLikes: engagementAvailable ? totalLikes : 0,
            totalComments: engagementAvailable ? totalComments : 0,
            totalViews: 0,
            engagementRate,
            engagementAvailable,
        };
    } catch (error) {
        console.error(`[InstagramAPI] Failed to fetch analytics for ${creator._id}:`, error.message);
        throw error;
    }
};

module.exports = { fetchInstagramAnalytics };
