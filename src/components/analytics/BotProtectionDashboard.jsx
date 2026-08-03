import React, { useState, useEffect } from 'react';

// Mock data generator for bot traffic
const generateBotData = () => {
  return [
    { id: 1, time: '2 mins ago', ip: '192.168.1.44', type: 'Search Engine', agent: 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
    { id: 2, time: '14 mins ago', ip: '45.22.19.102', type: 'Scraper', agent: 'python-requests/2.25.1' },
    { id: 3, time: '38 mins ago', ip: '89.102.4.55', type: 'Social Crawler', agent: 'facebookexternalhit/1.1' },
    { id: 4, time: '1 hr ago', ip: '204.11.50.2', type: 'Malicious Botnet', agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36' },
    { id: 5, time: '3 hrs ago', ip: '104.28.14.9', type: 'Automated Script', agent: 'curl/7.68.0' },
  ];
};

/**
 * Algorithmic Fraud & Bot Protection Dashboard
 * Visualizes the impact of the middleware filtering out bot traffic 
 * to ensure creators have accurate, sponsor-grade analytics.
 */
export const BotProtectionDashboard = () => {
  const [isShieldActive, setIsShieldActive] = useState(true);
  const [botLogs, setBotLogs] = useState([]);
  
  // Mock Analytics Numbers
  const rawClicks = 14592;
  const botClicks = 3108;
  const verifiedClicks = rawClicks - botClicks;
  const botPercentage = Math.round((botClicks / rawClicks) * 100);

  useEffect(() => {
    setBotLogs(generateBotData());
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Data Integrity & Bot Protection</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '750px', margin: '0 auto' }}>
          Stop presenting fake numbers to sponsors. Our algorithmic middleware silently scrubs scrapers, indexers, and botnets from your analytics so you only see genuine human engagement.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Shield Status Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '24px' }}>
            {isShieldActive && (
              <div style={{ position: 'absolute', inset: -10, backgroundColor: '#3b82f6', borderRadius: '50%', opacity: 0.1, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
                <style>{`@keyframes pulse { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.3; transform: scale(1.1); } }`}</style>
              </div>
            )}
            <div style={{ width: '100%', height: '100%', backgroundColor: isShieldActive ? '#eff6ff' : '#f1f5f9', border: `4px solid ${isShieldActive ? '#3b82f6' : '#cbd5e1'}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', zIndex: 10, position: 'relative', transition: 'all 0.3s ease' }}>
              🛡️
            </div>
          </div>
          
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>{isShieldActive ? 'Algorithmic Shield Active' : 'Shield Disabled'}</h3>
          <p style={{ color: '#64748b', margin: '0 0 24px 0', textAlign: 'center', fontSize: '14px' }}>
            {isShieldActive 
              ? 'Currently filtering known bot signatures, datacenter IPs, and headless browsers.'
              : 'Your analytics are currently displaying raw, unfiltered traffic.'}
          </p>

          <button 
            onClick={() => setIsShieldActive(!isShieldActive)}
            style={{ padding: '12px 24px', backgroundColor: isShieldActive ? '#ffffff' : '#0f172a', color: isShieldActive ? '#ef4444' : '#ffffff', border: isShieldActive ? '1px solid #fca5a5' : 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {isShieldActive ? 'Disable Protection (Not Recommended)' : 'Enable Bot Shield'}
          </button>
        </div>

        {/* Traffic Comparison Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Traffic Audit (Last 30 Days)</span>
            <span style={{ fontSize: '12px', backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '12px' }}>{botPercentage}% Fake Traffic</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 'bold' }}>Raw Gross Traffic</span>
                <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{rawClicks.toLocaleString()}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
                <div style={{ width: '100%', height: '100%', backgroundColor: '#cbd5e1', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>Filtered Bot Clicks</span>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-{botClicks.toLocaleString()}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
                <div style={{ width: `${botPercentage}%`, height: '100%', backgroundColor: '#ef4444', borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{ paddingTop: '24px', borderTop: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>Verified Human Engagement</span>
                <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '900' }}>{verifiedClicks.toLocaleString()}</span>
              </div>
              <div style={{ width: '100%', height: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                <div style={{ width: `${100 - botPercentage}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '6px' }} />
              </div>
              <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#64748b' }}>*This is the highly-accurate number you should report to brand sponsors.</p>
            </div>

          </div>
        </div>

      </div>

      {/* Bot Firewall Log */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Live Firewall Log</h3>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Showing most recent intercepts</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#ffffff', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '16px 24px' }}>Time</th>
                <th style={{ padding: '16px 24px' }}>IP Address</th>
                <th style={{ padding: '16px 24px' }}>Threat Type</th>
                <th style={{ padding: '16px 24px' }}>User Agent Signature</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {botLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                  <td style={{ padding: '16px 24px', color: '#64748b' }}>{log.time}</td>
                  <td style={{ padding: '16px 24px', fontFamily: 'monospace' }}>{log.ip}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ 
                      backgroundColor: log.type === 'Malicious Botnet' ? '#fee2e2' : '#f1f5f9',
                      color: log.type === 'Malicious Botnet' ? '#991b1b' : '#475569',
                      padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'
                    }}>
                      {log.type}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', color: '#64748b', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.agent}>
                    {log.agent}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <span style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <div style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }} /> Filtered
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
      </div>

    </div>
  );
};

export default BotProtectionDashboard;
