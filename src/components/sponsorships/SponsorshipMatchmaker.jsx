import React, { useState, useEffect } from 'react';

/**
 * Mock API representing an AI backend algorithm.
 * In production, this would hit an endpoint that analyzes the creator's YouTube/TikTok
 * analytics and cross-references it with an active brand database.
 */
const fetchAiRecommendations = async (creatorProfile) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, brand: 'TechGear', matchScore: 98, niche: 'Software Engineering', budget: '$5k - $10k', contact: 'partners@techgear.com' },
        { id: 3, brand: 'CodeAcademy', matchScore: 92, niche: 'Education', budget: '$8k - $15k', contact: 'influencers@codeacademy.dev' },
        { id: 2, brand: 'FitLife', matchScore: 65, niche: 'Fitness', budget: '$2k - $5k', contact: 'sponsorships@fitlife.co' }
      ]);
    }, 1500); // Simulate heavy AI analysis
  });
};

/**
 * SponsorshipMatchmaker
 * A dashboard component that displays AI-driven brand recommendations based on a creator's
 * analytics, and provides an integrated CRM entry point for outreach.
 */
export const SponsorshipMatchmaker = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crmStatus, setCrmStatus] = useState({});

  useEffect(() => {
    const getMatches = async () => {
      setLoading(true);
      // Pass the creator's contextual profile to the AI engine
      const data = await fetchAiRecommendations({ niche: 'software', audience: 'developers' });
      
      // Sort recommendations by match score automatically
      setRecommendations(data.sort((a, b) => b.matchScore - a.matchScore));
      setLoading(false);
    };
    getMatches();
  }, []);

  const handleOutreach = (brandId) => {
    // In production, this would trigger a modal to review an AI-generated email pitch,
    // and push the brand into the creator's pipeline/CRM database.
    setCrmStatus(prev => ({ ...prev, [brandId]: 'Email Sent' }));
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>AI Sponsorship Matchmaker</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Discover brand deals mathematically aligned with your audience.</p>
        </div>
        <span style={{ backgroundColor: '#f1f5f9', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', border: '1px solid #cbd5e1' }}>
          Audience Profile Strength: <span style={{ color: '#10b981' }}>92%</span>
        </span>
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ 
            width: '40px', height: '40px', 
            border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', 
            borderRadius: '50%', animation: 'spin 1s linear infinite', 
            margin: '0 auto 16px' 
          }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
          <h3 style={{ margin: '0 0 8px 0', color: '#334155' }}>Analyzing Audience Demographics...</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Cross-referencing your engagement metrics with active brand campaigns.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {recommendations.map(brand => {
            // Determine match pill coloring based on score
            const isHighMatch = brand.matchScore >= 90;
            const isMedMatch = brand.matchScore >= 75 && brand.matchScore < 90;
            
            const pillColor = isHighMatch ? '#dcfce7' : isMedMatch ? '#fef9c3' : '#fef2f2';
            const pillText = isHighMatch ? '#166534' : isMedMatch ? '#854d0e' : '#991b1b';

            return (
              <div 
                key={brand.id} 
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  backgroundColor: '#ffffff', border: '1px solid #cbd5e1', 
                  borderRadius: '12px', padding: '24px', 
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'; }}
              >
                
                {/* Brand Details */}
                <div>
                  <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', color: '#0f172a' }}>
                    {brand.brand} 
                    <span style={{ 
                      fontSize: '12px', backgroundColor: pillColor, color: pillText, 
                      padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' 
                    }}>
                      {brand.matchScore}% Audience Match
                    </span>
                  </h3>
                  
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Niche</p>
                      <p style={{ margin: 0, fontSize: '15px', color: '#334155', fontWeight: '500' }}>{brand.niche}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Est. Budget</p>
                      <p style={{ margin: 0, fontSize: '15px', color: '#334155', fontWeight: '500' }}>{brand.budget}</p>
                    </div>
                  </div>
                </div>

                {/* CRM Action Block */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '180px' }}>
                  <button 
                    onClick={() => handleOutreach(brand.id)}
                    disabled={!!crmStatus[brand.id]}
                    style={{ 
                      width: '100%',
                      padding: '12px 24px', 
                      backgroundColor: crmStatus[brand.id] ? '#10b981' : '#2563eb', 
                      color: '#ffffff', 
                      border: 'none', 
                      borderRadius: '8px', 
                      fontWeight: 'bold',
                      fontSize: '15px',
                      cursor: crmStatus[brand.id] ? 'default' : 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => { if (!crmStatus[brand.id]) e.target.style.backgroundColor = '#1d4ed8' }}
                    onMouseOut={(e) => { if (!crmStatus[brand.id]) e.target.style.backgroundColor = '#2563eb' }}
                  >
                    {crmStatus[brand.id] ? 'Generated ✓' : 'Draft AI Pitch'}
                  </button>
                  {crmStatus[brand.id] && (
                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>Added to CRM pipeline</span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SponsorshipMatchmaker;
