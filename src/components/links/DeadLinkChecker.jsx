import React, { useState } from 'react';

// Mock data representing a creator's bio links
const initialLinks = [
  { id: '1', title: 'My Main Channel', url: 'https://youtube.com/mychannel', status: 'pending', lastChecked: '-' },
  { id: '2', title: 'Buy My Course', url: 'https://mycourse.com/signup', status: 'pending', lastChecked: '-' },
  { id: '3', title: 'Sponsor: NordVPN Deal', url: 'https://nordvpn.com/mydeal', status: 'pending', lastChecked: '-' },
  { id: '4', title: 'Old Merch Drop (Expired)', url: 'https://store.mybrand.com/summer-drop-2023', status: 'pending', lastChecked: '-' }
];

// Mock API simulating a backend ping to these URLs
const runLinkScan = async (links) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const scannedLinks = links.map(link => {
        const now = new Date().toLocaleTimeString();
        if (link.id === '4') {
          return { ...link, status: 'error', statusCode: 404, lastChecked: now };
        }
        if (link.id === '3') {
          // Simulating a temporary server error or redirect loop
          return { ...link, status: 'warning', statusCode: 502, lastChecked: now };
        }
        return { ...link, status: 'healthy', statusCode: 200, lastChecked: now };
      });
      resolve(scannedLinks);
    }, 2500); // 2.5s simulated scan time
  });
};

/**
 * Automated Dead Link Checker Dashboard
 * Simulates a cron job that pings bio links to alert creators of broken URLs.
 */
export const DeadLinkChecker = () => {
  const [links, setLinks] = useState(initialLinks);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState('Never');

  const handleRunScan = async () => {
    setIsScanning(true);
    const results = await runLinkScan(links);
    setLinks(results);
    setLastScanTime(new Date().toLocaleTimeString());
    setIsScanning(false);
  };

  const errorCount = links.filter(l => l.status === 'error' || l.status === 'warning').length;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Bio Link Health Monitor</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '650px', margin: '0 auto' }}>
          Stop sending your audience to broken pages. We automatically ping your links every 7 days to ensure you aren't losing affiliate revenue to 404 errors.
        </p>
      </div>

      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>System Status</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Last automatic scan: {lastScanTime}</p>
        </div>
        <button 
          onClick={handleRunScan}
          disabled={isScanning}
          style={{ 
            backgroundColor: isScanning ? '#94a3b8' : '#2563eb', color: '#fff', 
            padding: '12px 24px', border: 'none', borderRadius: '8px', fontWeight: 'bold', 
            cursor: isScanning ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          {isScanning ? (
            <>
              <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Scanning URLs...
            </>
          ) : (
            'Run Manual Scan'
          )}
        </button>
      </div>

      {/* Alert Banner */}
      {!isScanning && errorCount > 0 && (
        <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '16px 24px', borderRadius: '0 12px 12px 0', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#991b1b', fontSize: '15px' }}>Action Required: Broken Links Detected</h4>
              <p style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>We found {errorCount} links returning errors. Please update your bio to avoid losing traffic.</p>
            </div>
          </div>
          <button style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            Fix Links Now
          </button>
        </div>
      )}

      {/* Link List */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr', padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
          <div>Link Title</div>
          <div>Destination URL</div>
          <div>Last Checked</div>
          <div style={{ textAlign: 'right' }}>Status</div>
        </div>

        {links.map((link, idx) => (
          <div key={link.id} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr', padding: '20px 24px', borderBottom: idx !== links.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
            
            <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14px' }}>
              {link.title}
            </div>

            <div>
              <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', wordBreak: 'break-all' }}>
                {link.url}
              </a>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {link.lastChecked}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {link.status === 'pending' && (
                <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Pending</span>
              )}
              {link.status === 'healthy' && (
                <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%' }} />
                  {link.statusCode} OK
                </span>
              )}
              {link.status === 'error' && (
                <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }} />
                  {link.statusCode} Error
                </span>
              )}
              {link.status === 'warning' && (
                <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ width: '6px', height: '6px', backgroundColor: '#f59e0b', borderRadius: '50%' }} />
                  {link.statusCode} Timeout
                </span>
              )}
            </div>
            
          </div>
        ))}
      </div>

    </div>
  );
};

export default DeadLinkChecker;
