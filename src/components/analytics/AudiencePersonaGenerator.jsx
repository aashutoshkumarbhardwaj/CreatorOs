import React, { useState } from 'react';

// Mock API representing the NLP backend processing 10k comments
const analyzeComments = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 'persona_1',
          archetype: 'Tech-Savvy Students',
          percentage: 45,
          color: '#3b82f6',
          icon: '🎓',
          painPoints: ['Cannot afford expensive enterprise tools', 'Struggling with tutorial hell', 'Time management during finals'],
          interests: ['Open-source software', 'Mechanical keyboards', 'Hackathons'],
          representativeQuote: '"I love this tech stack but I just wish it was free for college students so I could use it for my capstone project."'
        },
        {
          id: 'persona_2',
          archetype: 'Senior Engineers & Architects',
          percentage: 30,
          color: '#10b981',
          icon: '🏗️',
          painPoints: ['Legacy codebase migrations', 'Scaling infrastructure', 'Burnout and meetings'],
          interests: ['System Design', 'Ergonomic desk setups', 'Specialty Coffee'],
          representativeQuote: '"Great video on the microservices transition. We faced exactly this race condition at my firm last quarter."'
        },
        {
          id: 'persona_3',
          archetype: 'DIY Hobbyists & Tinkerers',
          percentage: 25,
          color: '#f59e0b',
          icon: '🛠️',
          painPoints: ['Sourcing niche hardware components', 'Lack of weekend project time', 'Debugging hardware/software bridging'],
          interests: ['Raspberry Pi/Arduino', '3D Printing', 'Home Automation'],
          representativeQuote: '"Have you tried hooking this up to a Raspberry Pi? I think you could automate the entire setup for under $50."'
        }
      ]);
    }, 2500); // 2.5 second simulated NLP latency
  });
};

/**
 * Audience Persona Generator
 * Analyzes thousands of YouTube/TikTok comments via NLP to extract
 * actionable buyer personas, pain points, and interests for merchandise and sponsorships.
 */
export const AudiencePersonaGenerator = () => {
  const [status, setStatus] = useState('idle'); // idle | analyzing | complete
  const [personas, setPersonas] = useState([]);

  const handleRunAnalysis = async () => {
    setStatus('analyzing');
    const results = await analyzeComments();
    setPersonas(results);
    setStatus('complete');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      {/* Header section */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Audience Persona Engine</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '600px', margin: '0 auto 24px' }}>
          Stop guessing who watches your videos. We use Natural Language Processing to analyze your last 10,000 comments and extract exact demographic psychographics.
        </p>

        {status === 'idle' && (
          <button 
            onClick={handleRunAnalysis}
            style={{ 
              backgroundColor: '#0f172a', color: '#ffffff', padding: '16px 32px', 
              fontSize: '16px', fontWeight: 'bold', borderRadius: '12px', border: 'none', 
              cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
          >
            Analyze Last 10,000 Comments
          </button>
        )}
      </div>

      {/* Analyzing / Loading State */}
      {status === 'analyzing' && (
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '64px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ 
              width: '40px', height: '40px', border: '4px solid #cbd5e1', 
              borderTopColor: '#3b82f6', borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }}>
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Scrubbing Comments via NLP...</h3>
          <p style={{ color: '#64748b' }}>Extracting semantic themes, pain points, and product requests.</p>
        </div>
      )}

      {/* Results State */}
      {status === 'complete' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {personas.map((persona) => (
            <div 
              key={persona.id} 
              style={{ 
                backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', 
                overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column'
              }}
            >
              
              {/* Persona Header */}
              <div style={{ backgroundColor: persona.color, padding: '24px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>{persona.icon}</div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>{persona.archetype}</h3>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px' }}>
                  {persona.percentage}% of Audience
                </div>
              </div>

              {/* Data Body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Top Pain Points</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {persona.painPoints.map((pp, i) => (
                      <li key={i}>{pp}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Overlapping Interests</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {persona.interests.map((interest, i) => (
                      <span key={i} style={{ backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', color: '#475569', border: '1px solid #cbd5e1' }}>
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Real Quote Extraction */}
                <div style={{ marginTop: 'auto', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', borderLeft: `4px solid ${persona.color}` }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Sample Extracted Quote</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontStyle: 'italic', lineHeight: '1.5' }}>
                    {persona.representativeQuote}
                  </p>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Actions */}
      {status === 'complete' && (
        <div style={{ marginTop: '32px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
            Export Persona PDF
          </button>
          <button style={{ backgroundColor: '#3b82f6', color: '#ffffff', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            Generate Merch Ideas based on Interests
          </button>
        </div>
      )}
    </div>
  );
};

export default AudiencePersonaGenerator;
