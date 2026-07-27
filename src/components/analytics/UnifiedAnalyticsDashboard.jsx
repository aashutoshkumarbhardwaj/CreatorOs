import React, { useState } from 'react';

// Mock data representing aggregated cross-platform metrics
const mockData = {
  globalReach: '4.2M',
  totalViews: '15.8M',
  engagementRate: '8.4%',
  platforms: [
    { name: 'YouTube', followers: 1200000, growth: '+15%', color: '#ef4444', roi: 'High' },
    { name: 'TikTok', followers: 2500000, growth: '+22%', color: '#0f172a', roi: 'Medium' },
    { name: 'Twitch', followers: 300000, growth: '+5%', color: '#8b5cf6', roi: 'High' },
    { name: 'Instagram', followers: 200000, growth: '-2%', color: '#ec4899', roi: 'Low' }
  ],
  // Timeline data for the unified growth trajectory graph
  timeline: [
    { month: 'Jan', youtube: 0.9, tiktok: 1.5, twitch: 0.2, ig: 0.2 },
    { month: 'Feb', youtube: 1.0, tiktok: 1.8, twitch: 0.25, ig: 0.2 },
    { month: 'Mar', youtube: 1.1, tiktok: 2.1, twitch: 0.28, ig: 0.2 },
    { month: 'Apr', youtube: 1.2, tiktok: 2.5, twitch: 0.3, ig: 0.2 }
  ]
};

/**
 * Unified Analytics Dashboard
 * Aggregates metrics across all major platforms into a single normalized view,
 * eliminating the need to check YouTube Studio, Twitch Dashboard, etc. separately.
 */
export const UnifiedAnalyticsDashboard = () => {
  const [activeTimeframe, setActiveTimeframe] = useState('30d');

  // Helper to format large numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>Unified Analytics</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>Your cross-platform growth and audience overlap at a glance.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          {['7d', '30d', '90d', 'YTD'].map(tf => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: activeTimeframe === tf ? '#ffffff' : 'transparent',
                color: activeTimeframe === tf ? '#0f172a' : '#64748b',
                fontWeight: activeTimeframe === tf ? '600' : '500',
                boxShadow: activeTimeframe === tf ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px', fontWeight: '500', textTransform: 'uppercase' }}>Global Reach (All Platforms)</p>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0f172a' }}>{mockData.globalReach}</div>
          <span style={{ color: '#10b981', fontSize: '14px', fontWeight: '600' }}>↑ 18.5% this month</span>
        </div>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px', fontWeight: '500', textTransform: 'uppercase' }}>Total Unified Views</p>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0f172a' }}>{mockData.totalViews}</div>
          <span style={{ color: '#10b981', fontSize: '14px', fontWeight: '600' }}>↑ 12.1% this month</span>
        </div>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px', fontWeight: '500', textTransform: 'uppercase' }}>Avg Engagement Rate</p>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0f172a' }}>{mockData.engagementRate}</div>
          <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Across 4 active platforms</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        
        {/* Left Column: Unified Trajectory Graph (CSS Mock) */}
        <div style={{ flex: 2, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '18px' }}>Unified Audience Trajectory</h3>
          
          <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '40px', padding: '0 20px', borderBottom: '2px solid #e2e8f0', borderLeft: '2px solid #e2e8f0', position: 'relative' }}>
            
            {/* Y-Axis Labels */}
            <div style={{ position: 'absolute', left: '-30px', bottom: '100%', color: '#94a3b8', fontSize: '12px' }}>5M</div>
            <div style={{ position: 'absolute', left: '-30px', bottom: '50%', color: '#94a3b8', fontSize: '12px' }}>2.5M</div>
            <div style={{ position: 'absolute', left: '-20px', bottom: '0', color: '#94a3b8', fontSize: '12px' }}>0</div>

            {/* Render Stacked Bars to represent unified growth over months */}
            {mockData.timeline.map((point) => {
              const total = point.youtube + point.tiktok + point.twitch + point.ig;
              const maxScale = 5.0; // 5M max
              const heightPct = (total / maxScale) * 100;
              
              return (
                <div key={point.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                  
                  {/* The Stacked Bar */}
                  <div style={{ width: '40px', height: `${heightPct}%`, display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px 4px 0 0', overflow: 'hidden', transition: 'height 0.3s ease' }}>
                    <div style={{ height: `${(point.youtube / total) * 100}%`, backgroundColor: '#ef4444' }} title={`YouTube: ${point.youtube}M`} />
                    <div style={{ height: `${(point.tiktok / total) * 100}%`, backgroundColor: '#0f172a' }} title={`TikTok: ${point.tiktok}M`} />
                    <div style={{ height: `${(point.twitch / total) * 100}%`, backgroundColor: '#8b5cf6' }} title={`Twitch: ${point.twitch}M`} />
                    <div style={{ height: `${(point.ig / total) * 100}%`, backgroundColor: '#ec4899' }} title={`Instagram: ${point.ig}M`} />
                  </div>

                  {/* X-Axis Label */}
                  <div style={{ position: 'absolute', top: '100%', marginTop: '12px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                    {point.month}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '40px' }}>
            {mockData.platforms.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: p.color }} />
                {p.name}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Platform Breakdown & ROI */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', flex: 1 }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Platform ROI Breakdown</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {mockData.platforms.map(platform => (
                <div key={platform.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: platform.color }} />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '15px', color: '#0f172a' }}>{platform.name}</div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>{formatNumber(platform.followers)} followers</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: '13px', fontWeight: 'bold', 
                      color: platform.growth.startsWith('+') ? '#10b981' : '#ef4444' 
                    }}>
                      {platform.growth}
                    </div>
                    <div style={{ 
                      fontSize: '11px', textTransform: 'uppercase', fontWeight: '600', marginTop: '4px',
                      color: platform.roi === 'High' ? '#10b981' : platform.roi === 'Medium' ? '#f59e0b' : '#64748b',
                      backgroundColor: '#f8fafc', padding: '2px 6px', borderRadius: '4px'
                    }}>
                      {platform.roi} ROI
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UnifiedAnalyticsDashboard;
