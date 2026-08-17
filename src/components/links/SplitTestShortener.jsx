import React, { useState, useEffect } from 'react';

// Mock data generator for A/B testing analytics
const generateMockAnalytics = () => {
  return {
    totalClicks: 1248,
    variantA: {
      url: 'https://myshop.com/product-v1',
      clicks: 620,
      conversions: 18,
      conversionRate: '2.9%',
      color: '#3b82f6'
    },
    variantB: {
      url: 'https://myshop.com/product-v2',
      clicks: 628,
      conversions: 42,
      conversionRate: '6.7%',
      color: '#10b981'
    }
  };
};

/**
 * Advanced A/B Testing Link Shortener
 * Allows creators to input two destination URLs under one shortened link.
 * The backend splits traffic 50/50 and provides comparative analytics.
 */
export const SplitTestShortener = () => {
  const [step, setStep] = useState('create'); // create | success | analytics
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [shortLink, setShortLink] = useState('');
  const [analytics, setAnalytics] = useState(null);

  const handleCreateLink = (e) => {
    e.preventDefault();
    if (!urlA || !urlB) return;
    
    // Mock short link generation
    const randomHash = Math.random().toString(36).substring(2, 8);
    setShortLink(`https://tit.le/${randomHash}`);
    setStep('success');
  };

  const loadAnalytics = () => {
    setAnalytics(generateMockAnalytics());
    setStep('analytics');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>A/B Split Test Shortener</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
          Stop guessing what converts. Add two landing pages to a single short link, and we'll automatically split your traffic 50/50 to see which page performs better.
        </p>
      </div>

      {/* Step 1: Create Link */}
      {step === 'create' && (
        <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleCreateLink} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', borderLeft: '4px solid #3b82f6' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                Destination URL A (Control)
              </label>
              <input 
                type="url" 
                value={urlA}
                onChange={(e) => setUrlA(e.target.value)}
                placeholder="https://yourstore.com/landing-page-1"
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-12px 0', zIndex: 10 }}>
              <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '4px solid #fff' }}>
                VS
              </div>
            </div>

            <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', borderLeft: '4px solid #10b981' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                Destination URL B (Variant)
              </label>
              <input 
                type="url" 
                value={urlB}
                onChange={(e) => setUrlB(e.target.value)}
                placeholder="https://yourstore.com/landing-page-2"
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>

            <button 
              type="submit"
              style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Generate Split Test Link 🔗
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Success State */}
      {step === 'success' && (
        <div style={{ textAlign: 'center', backgroundColor: '#ffffff', padding: '48px 32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '24px' }}>Your A/B Test Link is Live!</h3>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '12px 24px', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '32px' }}>
            <code style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb' }}>{shortLink}</code>
            <button style={{ marginLeft: '16px', padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Copy
            </button>
          </div>

          <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '32px' }}>
            Every time someone clicks this link, we will randomly route them to either Variant A or Variant B.
          </p>

          <button 
            onClick={loadAnalytics}
            style={{ padding: '12px 24px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            View Live Analytics (Mock Data)
          </button>
        </div>
      )}

      {/* Step 3: Analytics Dashboard */}
      {step === 'analytics' && analytics && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '24px', margin: 0 }}>Split Test Results</h3>
            <div style={{ backgroundColor: '#e2e8f0', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
              Total Clicks: {analytics.totalClicks}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            
            {/* Variant A Card */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: `2px solid ${analytics.variantA.color}`, overflow: 'hidden' }}>
              <div style={{ backgroundColor: analytics.variantA.color, color: '#fff', padding: '16px', fontWeight: 'bold', fontSize: '18px' }}>
                Variant A (Control)
              </div>
              <div style={{ padding: '24px' }}>
                <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px', wordBreak: 'break-all' }}>{analytics.variantA.url}</p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#475569' }}>Total Traffic Routed:</span>
                  <span style={{ fontWeight: 'bold' }}>{analytics.variantA.clicks} clicks</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ color: '#475569' }}>Conversions:</span>
                  <span style={{ fontWeight: 'bold' }}>{analytics.variantA.conversions}</span>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', textAlign: 'center', marginTop: '24px' }}>
                  <span style={{ display: 'block', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Conversion Rate</span>
                  <span style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a' }}>{analytics.variantA.conversionRate}</span>
                </div>
              </div>
            </div>

            {/* Variant B Card */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: `2px solid ${analytics.variantB.color}`, overflow: 'hidden' }}>
              <div style={{ backgroundColor: analytics.variantB.color, color: '#fff', padding: '16px', fontWeight: 'bold', fontSize: '18px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Variant B</span>
                <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>🏆 Winner</span>
              </div>
              <div style={{ padding: '24px' }}>
                <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px', wordBreak: 'break-all' }}>{analytics.variantB.url}</p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#475569' }}>Total Traffic Routed:</span>
                  <span style={{ fontWeight: 'bold' }}>{analytics.variantB.clicks} clicks</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ color: '#475569' }}>Conversions:</span>
                  <span style={{ fontWeight: 'bold', color: analytics.variantB.color }}>{analytics.variantB.conversions}</span>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '8px', textAlign: 'center', marginTop: '24px', border: `1px solid #bbf7d0` }}>
                  <span style={{ display: 'block', fontSize: '12px', color: '#166534', textTransform: 'uppercase', marginBottom: '4px' }}>Conversion Rate</span>
                  <span style={{ fontSize: '32px', fontWeight: '900', color: '#15803d' }}>{analytics.variantB.conversionRate}</span>
                </div>
              </div>
            </div>

          </div>

          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <button 
              onClick={() => setStep('create')}
              style={{ background: 'none', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}
            >
              Start New Test
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default SplitTestShortener;
