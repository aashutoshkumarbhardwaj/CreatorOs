const asyncHandler = require("../utils/asyncHandler");

/**
 * Sponsorship Rate Calculator Controller
 * Calculates sponsorship rates based on creator metrics and campaign details
 */

// Pricing factors and multipliers
const PRICING_FACTORS = {
    // Base rates per 1K followers by niche (adjusted to match example)
    nicheBaseRates: {
        technology: 85,
        gaming: 75,
        lifestyle: 60,
        education: 70,
        fintech: 95,
        beauty: 65,
        fitness: 55,
        food: 50,
        travel: 60,
        business: 90,
        entertainment: 45,
        other: 55
    },
    
    // Content type multipliers
    contentTypeMultipliers: {
        reel: 1.15,
        post: 1.0,
        story: 0.65,
        video: 1.4,
        tiktok: 1.1,
        linkedin: 0.95,
        twitter: 0.75
    },
    
    // Usage rights multipliers
    usageRightsMultipliers: {
        standard: 1.0,
        extended: 1.3,
        perpetual: 1.8,
        exclusive: 2.2
    },
    
    // Exclusivity multipliers
    exclusivityMultipliers: {
        none: 1.0,
        category: 1.2,
        category_extended: 1.4,
        brand: 1.5,
        brand_extended: 1.8
    },
    
    // Engagement rate bonus (per 1% above 2%)
    engagementBonus: 0.05,
    
    // Views bonus (per 1K views above 10K)
    viewsBonus: 0.02
};

/**
 * Calculate base rate from followers and niche
 */
function calculateBaseRate(followers, niche) {
    const followersInK = followers / 1000;
    const baseRatePerK = PRICING_FACTORS.nicheBaseRates[niche] || PRICING_FACTORS.nicheBaseRates.other;
    return Math.round(followersInK * baseRatePerK);
}

/**
 * Calculate engagement rate multiplier
 */
function calculateEngagementMultiplier(engagementRate) {
    if (engagementRate <= 2) return 1.0;
    const aboveBase = engagementRate - 2;
    return 1.0 + (aboveBase * PRICING_FACTORS.engagementBonus);
}

/**
 * Calculate views multiplier
 */
function calculateViewsMultiplier(avgViews) {
    if (avgViews <= 10000) return 1.0;
    const aboveBase = (avgViews - 10000) / 1000;
    return 1.0 + (aboveBase * PRICING_FACTORS.viewsBonus);
}

/**
 * Calculate content type multiplier
 */
function calculateContentTypeMultiplier(contentType) {
    return PRICING_FACTORS.contentTypeMultipliers[contentType] || 1.0;
}

/**
 * Calculate usage rights multiplier
 */
function calculateUsageRightsMultiplier(usageRights) {
    return PRICING_FACTORS.usageRightsMultipliers[usageRights] || 1.0;
}

/**
 * Calculate exclusivity multiplier
 */
function calculateExclusivityMultiplier(exclusivity) {
    return PRICING_FACTORS.exclusivityMultipliers[exclusivity] || 1.0;
}

/**
 * Calculate campaign duration adjustment
 */
function calculateDurationAdjustment(duration) {
    // Longer campaigns get slight discount per day
    if (duration <= 7) return 1.0;
    if (duration <= 30) return 0.98;
    if (duration <= 90) return 0.95;
    return 0.92;
}

/**
 * Calculate deliverable quantity adjustment
 */
function calculateDeliverableAdjustment(deliverables) {
    // Bulk discount for multiple deliverables
    if (deliverables === 1) return 1.0;
    if (deliverables <= 3) return 0.98;
    if (deliverables <= 5) return 0.95;
    return 0.92;
}

/**
 * Generate pricing breakdown
 */
function generateBreakdown(baseRate, contentMultiplier, engagementMultiplier, viewsMultiplier, 
                          usageMultiplier, exclusivityMultiplier, durationAdjustment, 
                          deliverableAdjustment, deliverables) {
    const breakdown = [];
    
    // Base rate
    breakdown.push({
        label: 'Base Rate (per 1K followers)',
        value: baseRate,
        isTotal: false
    });
    
    // Content type adjustment
    const contentAdjusted = Math.round(baseRate * (contentMultiplier - 1));
    if (contentAdjusted > 0) {
        breakdown.push({
            label: 'Content Type Premium',
            value: contentAdjusted,
            isTotal: false
        });
    }
    
    // Engagement bonus
    const engagementBonus = Math.round(baseRate * (engagementMultiplier - 1));
    if (engagementBonus > 0) {
        breakdown.push({
            label: 'Engagement Rate Bonus',
            value: engagementBonus,
            isTotal: false
        });
    }
    
    // Views bonus
    const viewsBonus = Math.round(baseRate * (viewsMultiplier - 1));
    if (viewsBonus > 0) {
        breakdown.push({
            label: 'Views Performance Bonus',
            value: viewsBonus,
            isTotal: false
        });
    }
    
    // Usage rights premium
    const usagePremium = Math.round(baseRate * (usageMultiplier - 1));
    if (usagePremium > 0) {
        breakdown.push({
            label: 'Usage Rights Premium',
            value: usagePremium,
            isTotal: false
        });
    }
    
    // Exclusivity premium
    const exclusivityPremium = Math.round(baseRate * (exclusivityMultiplier - 1));
    if (exclusivityPremium > 0) {
        breakdown.push({
            label: 'Exclusivity Premium',
            value: exclusivityPremium,
            isTotal: false
        });
    }
    
    // Duration discount
    const durationDiscount = Math.round(baseRate * (1 - durationAdjustment));
    if (durationDiscount > 0) {
        breakdown.push({
            label: 'Campaign Duration Discount',
            value: -durationDiscount,
            isTotal: false
        });
    }
    
    // Deliverable discount
    const deliverableDiscount = Math.round(baseRate * (1 - deliverableAdjustment));
    if (deliverableDiscount > 0) {
        breakdown.push({
            label: 'Bulk Deliverable Discount',
            value: -deliverableDiscount,
            isTotal: false
        });
    }
    
    return breakdown;
}

/**
 * Generate explanation for the rate calculation
 */
function generateExplanation(data, calculatedRates, multipliers) {
    const { followers, avgViews, engagementRate, niche, contentType, deliverables, 
            campaignDuration, usageRights, exclusivity } = data;
    
    let explanation = `<p><strong>Rate Calculation Summary:</strong></p>`;
    explanation += `<p>Your sponsorship rate is calculated based on several key factors:</p>`;
    
    explanation += `<ul>`;
    explanation += `<li><strong>Base Rate:</strong> ₹${calculatedRates.baseRate.toLocaleString()} based on ${followers.toLocaleString()} followers in the ${niche} niche</li>`;
    
    if (multipliers.engagement > 1.0) {
        explanation += `<li><strong>Engagement Bonus:</strong> +${Math.round((multipliers.engagement - 1) * 100)}% for your ${engagementRate}% engagement rate (above 2% baseline)</li>`;
    }
    
    if (multipliers.views > 1.0) {
        explanation += `<li><strong>Views Performance:</strong> +${Math.round((multipliers.views - 1) * 100)}% for averaging ${avgViews.toLocaleString()} views per post</li>`;
    }
    
    explanation += `<li><strong>Content Type:</strong> ${contentType.charAt(0).toUpperCase() + contentType.slice(1)} multiplier (${multipliers.content}x)</li>`;
    
    if (multipliers.usage > 1.0) {
        explanation += `<li><strong>Usage Rights:</strong> ${usageRights.charAt(0).toUpperCase() + usageRights.slice(1)} rights premium (${multipliers.usage}x)</li>`;
    }
    
    if (multipliers.exclusivity > 1.0) {
        explanation += `<li><strong>Exclusivity:</strong> ${exclusivity.replace(/_/g, ' ')} premium (${multipliers.exclusivity}x)</li>`;
    }
    
    if (multipliers.duration < 1.0) {
        explanation += `<li><strong>Duration Discount:</strong> -${Math.round((1 - multipliers.duration) * 100)}% for ${campaignDuration}-day campaign</li>`;
    }
    
    if (multipliers.deliverables < 1.0) {
        explanation += `<li><strong>Bulk Discount:</strong> -${Math.round((1 - multipliers.deliverables) * 100)}% for ${deliverables} deliverables</li>`;
    }
    
    explanation += `</ul>`;
    
    explanation += `<p><strong>Recommended Rate:</strong> ₹${calculatedRates.recommendedRate.toLocaleString()} falls within a realistic range for creators with your metrics and the specified campaign requirements.</p>`;
    
    explanation += `<p><strong>Negotiation Tips:</strong></p>`;
    explanation += `<ul>`;
    explanation += `<li>Use the recommended rate as your starting point in negotiations</li>`;
    explanation += `<li>Consider your relationship with the brand and long-term partnership potential</li>`;
    explanation += `<li>Factor in your content creation time and production costs</li>`;
    explanation += `<li>The maximum rate accounts for premium brands and urgent deliverables</li>`;
    explanation += `</ul>`;
    
    return explanation;
}

/**
 * Main calculation function
 */
const calculateSponsorshipRate = asyncHandler(async (req, res) => {
    const {
        followers,
        avgViews,
        engagementRate,
        niche,
        contentType,
        deliverables,
        campaignDuration,
        usageRights,
        exclusivity
    } = req.body;
    
    // Validate required fields
    if (!followers || !avgViews || !engagementRate || !niche || !contentType ||
        !deliverables || !campaignDuration || !usageRights || !exclusivity) {
        return res.status(400).json({
            success: false,
            message: 'All required fields must be provided'
        });
    }

    const numFollowers = Number(followers);
    const numAvgViews = Number(avgViews);
    const numEngagementRate = Number(engagementRate);
    const numDeliverables = Number(deliverables);
    const numCampaignDuration = Number(campaignDuration);

    if (
        isNaN(numFollowers) || isNaN(numAvgViews) || isNaN(numEngagementRate) ||
        isNaN(numDeliverables) || isNaN(numCampaignDuration)
    ) {
        return res.status(400).json({
            success: false,
            message: 'followers, avgViews, engagementRate, deliverables, and campaignDuration must be numbers'
        });
    }

    // Validate numeric ranges
    if (numFollowers < 0 || numAvgViews < 0 || numEngagementRate < 0 || numEngagementRate > 100 ||
        numDeliverables < 1 || numDeliverables > 50 || numCampaignDuration < 1 || numCampaignDuration > 365) {
        return res.status(400).json({
            success: false,
            message: 'Invalid numeric values provided'
        });
    }
    
    try {
        // Calculate multipliers
        const baseRate = calculateBaseRate(numFollowers, niche);
        const engagementMultiplier = calculateEngagementMultiplier(numEngagementRate);
        const viewsMultiplier = calculateViewsMultiplier(numAvgViews);
        const contentMultiplier = calculateContentTypeMultiplier(contentType);
        const usageMultiplier = calculateUsageRightsMultiplier(usageRights);
        const exclusivityMultiplier = calculateExclusivityMultiplier(exclusivity);
        const durationAdjustment = calculateDurationAdjustment(numCampaignDuration);
        const deliverableAdjustment = calculateDeliverableAdjustment(numDeliverables);
        
        // Calculate single deliverable rate
        const singleDeliverableRate = Math.round(
            baseRate * 
            engagementMultiplier * 
            viewsMultiplier * 
            contentMultiplier * 
            usageMultiplier * 
            exclusivityMultiplier * 
            durationAdjustment * 
            deliverableAdjustment
        );
        
        // Calculate total rate for all deliverables
        const totalRate = singleDeliverableRate * numDeliverables;
        
        // Calculate rate range (±15% for negotiation room)
        const minRate = Math.round(totalRate * 0.85);
        const recommendedRate = totalRate;
        const maxRate = Math.round(totalRate * 1.15);
        
        // Generate breakdown
        const breakdown = generateBreakdown(
            baseRate, contentMultiplier, engagementMultiplier, viewsMultiplier,
            usageMultiplier, exclusivityMultiplier, durationAdjustment,
            deliverableAdjustment, numDeliverables
        );

        // Add total to breakdown
        breakdown.push({
            label: 'Total Recommended Rate',
            value: recommendedRate,
            isTotal: true
        });
        
        // Generate explanation
        const multipliers = {
            engagement: engagementMultiplier,
            views: viewsMultiplier,
            content: contentMultiplier,
            usage: usageMultiplier,
            exclusivity: exclusivityMultiplier,
            duration: durationAdjustment,
            deliverables: deliverableAdjustment
        };
        
        const calculatedRates = {
            baseRate,
            recommendedRate
        };
        
        const explanation = generateExplanation(req.body, calculatedRates, multipliers);
        
        res.json({
            success: true,
            data: {
                minRate,
                recommendedRate,
                maxRate,
                breakdown,
                explanation,
                inputMetrics: {
                    followers: numFollowers,
                    avgViews: numAvgViews,
                    engagementRate: numEngagementRate,
                    niche,
                    contentType,
                    deliverables: numDeliverables,
                    campaignDuration: numCampaignDuration,
                    usageRights,
                    exclusivity
                }
            }
        });
        
    } catch (error) {
        console.error('Error calculating sponsorship rate:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating sponsorship rate'
        });
    }
});

module.exports = {
    calculateSponsorshipRate
};