const fetchInstagramAnalytics = async (creator) => {
    if (creator.platform !== 'instagram' || !creator.accessToken) {
        throw new Error('Creator does not have a valid Instagram access token or is not on the Instagram platform.');
    }

    try {
        const platformId = creator.platformId || 'me';
        // Using global fetch (available in Node 18+)
        const response = await fetch(`https://graph.instagram.com/${platformId}?fields=followers_count,follows_count,media_count,id,username&access_token=${creator.accessToken}`);
        
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Instagram API Error: ${response.status} - ${errBody}`);
        }

        const data = await response.json();
        
        // Note: Full engagement metrics require fetching all media edges. 
        // We calculate basic metrics available directly on the user node, and leave the rest 
        // as null so we don't corrupt historical data with fabrications.
        const totalPosts = data.media_count || 0;

        return {
            followers: data.followers_count || 0,
            following: data.follows_count || 0,
            totalPosts,
            totalLikes: null,
            totalComments: null,
            totalViews: null,
            engagementRate: null,
        };
    } catch (error) {
        console.error(`[InstagramAPI] Failed to fetch analytics for ${creator._id}:`, error.message);
        throw error;
    }
};

module.exports = { fetchInstagramAnalytics };
