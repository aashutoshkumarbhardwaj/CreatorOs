import React, { useState } from 'react';
import { useChunkedUpload } from '../../hooks/useChunkedUpload';

const ResumableUploader = () => {
  const [file, setFile] = useState(null);
  const { progress, status, error, start, pause, resume, cancel } = useChunkedUpload(file);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      cancel(); // Reset any previous uploads
    }
  };

  const formatSize = (bytes) => (bytes / (1024 * 1024)).toFixed(2);

  return (
    <div style={{ border: '1px solid #e2e8f0', padding: '24px', borderRadius: '12px', maxWidth: '450px', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 16px 0' }}>Upload High-Res Video</h3>
      <input 
        type="file" 
        onChange={handleFileChange} 
        disabled={status === 'uploading'} 
        style={{ marginBottom: '16px' }}
      />
      
      {file && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ marginBottom: '12px', fontSize: '14px', color: '#334155' }}>
            <strong>{file.name}</strong> ({formatSize(file.size)} MB)
          </div>
          
          <div style={{ background: '#f1f5f9', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${progress}%`, 
                background: status === 'error' ? '#ef4444' : status === 'success' ? '#22c55e' : '#3b82f6', 
                height: '100%',
                transition: 'width 0.4s ease, background-color 0.3s ease'
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
            <span>{progress}%</span>
            <span style={{ textTransform: 'capitalize' }}>{status}</span>
          </div>

          {error && <div style={{ color: '#ef4444', marginTop: '12px', fontSize: '14px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            {(status === 'idle' || status === 'error') && (
              <button 
                onClick={start}
                style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Start Upload
              </button>
            )}
            {status === 'uploading' && (
              <button 
                onClick={pause}
                style={{ padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Pause
              </button>
            )}
            {status === 'paused' && (
              <button 
                onClick={resume}
                style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Resume
              </button>
            )}
            {(status === 'uploading' || status === 'paused' || status === 'error') && (
              <button 
                onClick={cancel}
                style={{ padding: '8px 16px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumableUploader;
