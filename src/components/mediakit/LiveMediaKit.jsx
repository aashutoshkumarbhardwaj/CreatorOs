import React, { useState, useEffect } from 'react';

// Mock live data payload simulating what the backend would return
const mockData = {
  creator: {
    name: 'Alex Chen',
    tagline: 'Software Engineer & Tech Educator',
    bio: 'Bridging the gap between complex engineering concepts and accessible tutorials. Reaching millions of developers monthly across YouTube and TikTok.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexChen&backgroundColor=e2e8f0',
    contactEmail: 'partnerships@alexchen.dev'
  },
  liveStats: [
    { platform: 'YouTube', metric: 'Subscribers', count: 1245000, color: '#ef4444' },
    { platform: 'TikTok', metric: 'Followers', count: 2800000, color: '#0f172a' },
    { platform: 'Twitter/X', metric: 'Followers', count: 450000, color: '#0ea5e9' }
  ],
  demographics: {
    ageGroups: [
      { range: '18-24', percentage: 45 },
      { range: '25-34', percentage: 35 },
      { range: '35-44', percentage: 15 },
      { range: 'Other', percentage: 5 }
    ],
    topCountries: ['United States', 'United Kingdom', 'India', 'Canada'],
    gender: { male: 72, female: 25, other: 3 }
  },
  recentVideos: [
    { title: 'I Built a Web3 App in 24 Hours', views: 1200500, thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80' },
    { title: 'Stop using React.useEffect()', views: 850200, thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80' },
    { title: 'My $50,000 Desk Setup', views: 2100000, thumbnail: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=400&q=80' }
  ]
};

/**
 * LiveMediaKit
 * A public-facing component that serves as a dynamic, auto-updating media kit for creators.
 * It eliminates the need to constantly update PDFs by pulling live metrics.
 */
export const LiveMediaKit = () => {
  const [data, setData] = useState(mockData);
  const [isLive, setIsLive] = useState(true);

  // Simulate a live polling environment where numbers slowly tick up
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => {
        const newStats = prevData.liveStats.map(stat => ({
          ...stat,
          count: stat.count + Math.floor(Math.random() * 5) // random growth
        }));
        return { ...prevData, liveStats: newStats };
      });
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        
        {/* Live Status Banner */}
        <div style={{ backgroundColor: '#0f172a', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ffffff' }}>
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>CreatorOS Dynamic Media Kit</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Pulsing red dot for "Live" status */}
            <div style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%', animation: 'pulse 2s infinite' }}>
              <style>{`@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }`}</style>
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '1px' }}>LIVE METRICS</span>
          </div>
        </div>

        {/* Hero Profile Section */}
        <div style={{ padding: '48px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '40px', alignItems: 'center' }}>
          <img 
            src={data.creator.avatar} 
            alt={data.creator.name} 
            style={{ width: '160px', height: '160px', borderRadius: '50%', border: '4px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
          />
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '40px', color: '#0f172a', letterSpacing: '-1px' }}>{data.creator.name}</h1>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#3b82f6', fontWeight: '500' }}>{data.creator.tagline}</h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#475569', lineHeight: '1.6', maxWidth: '600px' }}>{data.creator.bio}</p>
            <a 
              href={`mailto:${data.creator.contactEmail}`}
              style={{ display: 'inline-block', backgroundColor: '#0f172a', color: '#ffffff', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#334155'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#0f172a'}
            >
              Contact for Partnerships
            </a>
          </div>
        </div>

        {/* Live Numbers Section */}
        <div style={{ padding: '48px', backgroundColor: '#f8fafc' }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '24px', color: '#0f172a' }}>Global Reach</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {data.liveStats.map(stat => (
              <div key={stat.platform} style={{ backgroundColor: '#ffffff', padding: '32px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ color: stat.color, fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>{stat.platform}</div>
                
                {/* Notice we format the number but keep it tied to the exact live ticking state */}
                <div style={{ fontSize: '48px', fontWeight: '800', color: '#0f172a', lineHeight: '1', fontFamily: 'monospace' }}>
                  {formatNumber(stat.count)}
                </div>
                <div style={{ color: '#64748b', fontSize: '14px', marginTop: '8px', fontWeight: '500' }}>Total {stat.metric}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Demographics & Recent Performance Split */}
        <div style={{ display: 'flex', padding: '48px', gap: '48px' }}>
          
          {/* Audience Demographics */}
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '24px', color: '#0f172a' }}>Audience Demographics</h3>
            
            <div style={{ marginBottom: '32px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#475569' }}>Age Distribution</h4>
              {data.demographics.ageGroups.map(age => (
                <div key={age.range} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#334155' }}>
                    <span>{age.range}</span>
                    <span>{age.percentage}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${age.percentage}%`, height: '100%', backgroundColor: '#3b82f6' }} />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#475569' }}>Top Geographies</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {data.demographics.topCountries.map(country => (
                  <span key={country} style={{ backgroundColor: '#f1f5f9', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', color: '#334155', fontWeight: '500', border: '1px solid #e2e8f0' }}>
                    {country}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Top Performers */}
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '24px', color: '#0f172a' }}>Recent Top Performers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {data.recentVideos.map((video, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'box-shadow 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'} onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{ width: '120px', height: '68px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#e2e8f0', backgroundImage: `url(${video.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0f172a', fontWeight: '600', lineHeight: '1.4' }}>{video.title}</h4>
                    <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                      {formatNumber(video.views)} Views
                    </span>
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

export default LiveMediaKit;
