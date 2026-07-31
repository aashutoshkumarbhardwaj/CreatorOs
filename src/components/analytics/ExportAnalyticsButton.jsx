import React from 'react';
import { useCsvWorker } from '../../hooks/useCsvWorker';

const ExportAnalyticsButton = ({ data, filename }) => {
  const { exportCsv, isExporting, error } = useCsvWorker();

  const handleExport = () => {
    exportCsv(data, filename);
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <button 
        onClick={handleExport} 
        disabled={isExporting || !data || data.length === 0}
        style={{
          padding: '10px 20px',
          backgroundColor: isExporting ? '#94a3b8' : '#2563eb',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: isExporting || !data || data.length === 0 ? 'not-allowed' : 'pointer',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'background-color 0.2s',
          fontSize: '14px'
        }}
      >
        {isExporting ? (
          <>
            <span style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              border: '3px solid rgba(255,255,255,0.3)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}>
              <style>
                {`@keyframes spin { to { transform: rotate(360deg); } }`}
              </style>
            </span>
            Processing...
          </>
        ) : (
          'Export Analytics (CSV)'
        )}
      </button>
      {error && <div style={{ color: '#ef4444', marginTop: '8px', fontSize: '13px', fontWeight: '500' }}>Error: {error}</div>}
    </div>
  );
};

export default ExportAnalyticsButton;
