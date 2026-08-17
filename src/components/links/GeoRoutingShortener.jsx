import React, { useState } from 'react';

// Mock data for country selection
const countries = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' }
];

// Mock analytics data generator
const generateMockAnalytics = () => {
  return {
    totalClicks: 8432,
    routes: [
      { country: 'United States', code: 'US', flag: '🇺🇸', clicks: 4120, percentage: 48.8, url: 'amazon.com/dp/B08F7PTF53' },
      { country: 'United Kingdom', code: 'GB', flag: '🇬🇧', clicks: 1850, percentage: 21.9, url: 'amazon.co.uk/dp/B08F7PTF53' },
      { country: 'Canada', code: 'CA', flag: '🇨🇦', clicks: 1205, percentage: 14.3, url: 'amazon.ca/dp/B08F7PTF53' },
      { country: 'Other (Default)', code: 'DEFAULT', flag: '🌍', clicks: 1257, percentage: 15.0, url: 'my-global-store.com' }
    ]
  };
};

/**
 * Geolocation-Based Link Routing
 * Allows creators to define different destination URLs based on the user's IP geolocation.
 */
export const GeoRoutingShortener = () => {
  const [step, setStep] = useState('create'); // create | success | analytics
  const [defaultUrl, setDefaultUrl] = useState('');
  const [geoRules, setGeoRules] = useState([{ id: 1, countryCode: 'GB', url: '' }]);
  const [shortLink, setShortLink] = useState('');
  const [analytics, setAnalytics] = useState(null);

  const handleAddRule = () => {
    setGeoRules([...geoRules, { id: Date.now(), countryCode: 'CA', url: '' }]);
  };

  const handleRemoveRule = (id) => {
    setGeoRules(geoRules.filter(rule => rule.id !== id));
  };

  const handleRuleChange = (id, field, value) => {
    setGeoRules(geoRules.map(rule => rule.id === id ? { ...rule, [field]: value } : rule));
  };

  const handleCreateLink = (e) => {
    e.preventDefault();
    if (!defaultUrl) return;
    
    // Mock short link generation
    const randomHash = Math.random().toString(36).substring(2, 8);
    setShortLink(`https://tit.le/geo/${randomHash}`);
    setStep('success');
  };

  const loadAnalytics = () => {
    setAnalytics(generateMockAnalytics());
    setStep('analytics');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Geo-Routing Link Shortener</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '650px', margin: '0 auto' }}>
          Stop losing international affiliate commissions. Automatically redirect clicks to the correct localized storefront based on the user's IP country.
        </p>
      </div>

      {/* Step 1: Create Link */}
      {step === 'create' && (
        <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleCreateLink} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Default Route */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>🌍</span>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Global Default URL</h3>
              </div>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 12px 0' }}>Where should users go if they don't match a specific country rule?</p>
              <input 
                type="url" 
                value={defaultUrl}
                onChange={(e) => setDefaultUrl(e.target.value)}
                placeholder="https://my-global-store.com"
                required
                style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '2px solid #cbd5e1', boxSizing: 'border-box', fontSize: '15px' }}
              />
            </div>

            <hr style={{ borderTop: '1px dashed #cbd5e1', borderBottom: 'none' }} />

            {/* Geo Rules */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Country-Specific Overrides</h3>
                <button 
                  type="button" 
                  onClick={handleAddRule}
                  style={{ background: '#f1f5f9', border: 'none', color: '#2563eb', fontWeight: 'bold', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  + Add Country
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {geoRules.map((rule, index) => (
                  <div key={rule.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#475569' }}>If user is in:</label>
                      <select 
                        value={rule.countryCode}
                        onChange={(e) => handleRuleChange(rule.id, 'countryCode', e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px' }}
                      >
                        {countries.map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#475569' }}>Redirect them to:</label>
                      <input 
                        type="url" 
                        value={rule.url}
                        onChange={(e) => handleRuleChange(rule.id, 'url', e.target.value)}
                        placeholder="https://amazon.co.uk/..."
                        required
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }}
                      />
                    </div>

                    <button 
                      type="button"
                      onClick={() => handleRemoveRule(rule.id)}
                      style={{ marginTop: '28px', background: 'none', border: 'none', color: '#ef4444', fontSize: '20px', cursor: 'pointer', padding: '8px' }}
                      title="Remove Rule"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button 
              type="submit"
              style={{ width: '100%', padding: '16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)' }}
            >
              Generate Geo-Link 📍
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Success State */}
      {step === 'success' && (
        <div style={{ textAlign: 'center', backgroundColor: '#ffffff', padding: '48px 32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '24px' }}>Your Smart Geo-Link is Live!</h3>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '16px 32px', borderRadius: '8px', border: '2px solid #2563eb', marginBottom: '32px' }}>
            <code style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>{shortLink}</code>
            <button style={{ marginLeft: '24px', padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Copy Link
            </button>
          </div>

          <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '40px', maxWidth: '500px', margin: '0 auto 40px' }}>
            Place this single link in your bio. Our edge network will intercept clicks and route users to the correct country store in less than 50 milliseconds.
          </p>

          <button 
            onClick={loadAnalytics}
            style={{ padding: '12px 24px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            View Live Routing Analytics
          </button>
        </div>
      )}

      {/* Step 3: Analytics Dashboard */}
      {step === 'analytics' && analytics && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '24px', margin: 0 }}>Global Traffic Distribution</h3>
            <div style={{ backgroundColor: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
              {analytics.totalClicks.toLocaleString()} Total Clicks
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            
            {/* Table Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr', padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
              <div>User Location</div>
              <div>Destination URL</div>
              <div style={{ textAlign: 'right' }}>Traffic %</div>
            </div>

            {/* Table Rows */}
            {analytics.routes.map((route, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr', padding: '24px', borderBottom: idx !== analytics.routes.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{route.flag}</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{route.country}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{route.clicks.toLocaleString()} clicks</div>
                  </div>
                </div>

                <div>
                  <a href={`https://${route.url}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px', wordBreak: 'break-all' }}>
                    {route.url}
                  </a>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#0f172a' }}>{route.percentage}%</span>
                  <div style={{ width: '80px', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${route.percentage}%`, height: '100%', backgroundColor: route.code === 'DEFAULT' ? '#94a3b8' : '#3b82f6' }} />
                  </div>
                </div>
                
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <button 
              onClick={() => setStep('create')}
              style={{ background: 'none', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}
            >
              Create New Geo-Link
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default GeoRoutingShortener;
