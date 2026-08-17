import React, { useState } from 'react';

/**
 * Interactive 3D Asset Previewer for Smart Bios
 * Allows 3D artists to upload .gltf or .glb files and preview them 
 * interactively right on their bio page using WebGL.
 */
export const AssetPreviewer3D = () => {
  const [step, setStep] = useState('upload'); // upload | uploading | preview
  const [fileData, setFileData] = useState(null);

  const handleFileUpload = (e) => {
    e.preventDefault();
    // Simulate reading a file
    setStep('uploading');
    setTimeout(() => {
      // In a real app, this would be an uploaded Blob or S3 URL.
      // For the mock, we will use a sample 3D model URL from the model-viewer docs
      setFileData({
        name: 'cyborg_character_v2.glb',
        size: '4.2 MB',
        url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
      });
      setStep('preview');
    }, 2000); // 2 second simulated upload
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      {/* Required script for model-viewer to work if rendering in a real DOM */}
      <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Interactive 3D Asset Previewer</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '650px', margin: '0 auto' }}>
          Don't make fans leave your bio to see your work. Upload .glb or .gltf files and embed a highly optimized, interactive 3D WebGL viewer directly on your profile.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
        
        {/* Left Side: Upload Controls */}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '20px', margin: '0 0 24px 0' }}>Asset Management</h3>
          
          {step === 'upload' && (
            <div 
              style={{ 
                border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '64px 32px', 
                textAlign: 'center', backgroundColor: '#f8fafc', transition: 'border-color 0.2s',
                cursor: 'pointer'
              }}
              onClick={handleFileUpload}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>Click or Drag 3D Model Here</h4>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>Supports .gltf, .glb, and .obj files (Max 25MB)</p>
              
              <button 
                style={{ padding: '12px 24px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Browse Local Files
              </button>
            </div>
          )}

          {step === 'uploading' && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '64px 32px', textAlign: 'center', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}>
                  <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Processing 3D Geometry...</h4>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Compressing textures and generating WebGL preview.</p>
            </div>
          )}

          {step === 'preview' && fileData && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>✅</span> Asset Successfully Processed
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                  Your model is ready to be embedded on your smart bio.
                </p>
              </div>
              
              <div style={{ padding: '24px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Filename</span>
                  <span style={{ fontSize: '13px', color: '#0f172a' }}>{fileData.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Optimized Size</span>
                  <span style={{ fontSize: '13px', color: '#0f172a' }}>{fileData.size}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Format</span>
                  <span style={{ fontSize: '13px', color: '#10b981', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>WebGL Ready</span>
                </div>
              </div>

              <div style={{ padding: '24px' }}>
                <button 
                  onClick={() => setStep('upload')}
                  style={{ width: '100%', padding: '12px', backgroundColor: '#ffffff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Delete Asset & Upload New
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Live Bio Preview */}
        <div style={{ 
          width: '340px', backgroundColor: '#0f172a', borderRadius: '40px', border: '8px solid #cbd5e1', 
          padding: '24px', boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          position: 'relative'
        }}>
          {/* Fake Notch */}
          <div style={{ width: '100px', height: '24px', backgroundColor: '#cbd5e1', borderRadius: '0 0 16px 16px', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} />

          <div style={{ marginTop: '24px', textAlign: 'center', color: '#ffffff' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#3b82f6', margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>@3D_Artist</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#94a3b8' }}>Game Developer & Modeler</p>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <button style={{ width: '100%', padding: '16px', fontSize: '14px', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#ffffff', fontWeight: 'bold' }}>
              My ArtStation Portfolio
            </button>

            {/* 3D Model Viewer Container */}
            <div style={{ 
              width: '100%', height: '280px', backgroundColor: '#1e293b', borderRadius: '12px', 
              overflow: 'hidden', border: '1px solid #334155', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              
              {step === 'preview' && fileData ? (
                // Use the Google model-viewer web component
                <model-viewer 
                  src={fileData.url} 
                  auto-rotate 
                  camera-controls 
                  interaction-prompt="none"
                  style={{ width: '100%', height: '100%', backgroundColor: '#1e293b' }}
                >
                </model-viewer>
              ) : (
                <div style={{ color: '#475569', fontSize: '13px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧊</div>
                  3D Asset Placeholder
                </div>
              )}
              
            </div>

            <button style={{ width: '100%', padding: '16px', fontSize: '14px', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: '#ffffff', fontWeight: 'bold' }}>
              Commission Me
            </button>

          </div>
        </div>

      </div>

    </div>
  );
};

export default AssetPreviewer3D;
