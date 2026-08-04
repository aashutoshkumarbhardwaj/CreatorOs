const fetchInstagramAnalytics = async (creator) => {
    if (creator.platform !== 'instagram' || !creator.accessToken) {
        throw new Error('Creator does not have a valid Instagram access token or is not on the Instagram platform.');
    }

    try {
        const platformId = creator.platformId || 'me';
        // Using global fetch (available in Node 18+)
        const response = await fetch(
            `https://graph.instagram.com/${platformId}?fields=followers_count,follows_count,media_count,id,username,media.limit(50){like_count,comments_count}&access_token=${creator.accessToken}`
        );
        
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Instagram API Error: ${response.status} - ${errBody}`);
        }

        const data = await response.json();
        
        const totalPosts = data.media_count || 0;
        const followers = data.followers_count || 0;
        const following = data.follows_count || 0;

        let totalLikes = 0;
        let totalComments = 0;
        let engagementAvailable = false;

        const mediaList = data.media?.data || (Array.isArray(data.media) ? data.media : null);

        if (Array.isArray(mediaList) && mediaList.length > 0) {
            let hasCounts = false;
            for (const item of mediaList) {
                if (typeof item.like_count === 'number' || typeof item.comments_count === 'number') {
                    totalLikes += item.like_count || 0;
                    totalComments += item.comments_count || 0;
                    hasCounts = true;
                }
            }
            if (hasCounts) {
                engagementAvailable = true;
            }
        }

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
