import React, { useState } from 'react';

/**
 * Dynamic QR Code Customization Engine
 * Allows creators to generate highly branded QR codes with custom colors,
 * gradients, eye shapes, and center logos to increase physical scan rates.
 */
export const CustomQrGenerator = () => {
  const [url, setUrl] = useState('https://tit.le/my-link');
  const [color, setColor] = useState('#2563eb');
  const [eyeShape, setEyeShape] = useState('square'); // square | round | leaf
  const [hasLogo, setHasLogo] = useState(false);

  // Mock calculation to determine if the QR code remains scannable
  // (In a real app, this would dynamically check error correction capacity vs logo size)
  const isScannable = url.length > 5;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Pro QR Code Studio</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '650px', margin: '0 auto' }}>
          Standard black-and-white QR codes are ignored. Boost your physical scan rates by 30% by customizing your codes to match your brand's aesthetic.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
        
        {/* Left Side: Controls */}
        <div style={{ flex: 1, backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>
              Destination URL
            </label>
            <input 
              type="url" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '15px' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>
              Brand Color
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['#0f172a', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ 
                    width: '36px', height: '36px', borderRadius: '50%', backgroundColor: c, 
                    border: color === c ? '4px solid #cbd5e1' : 'none', cursor: 'pointer',
                    transition: 'transform 0.1s'
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>
              Eye Shape
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['square', 'round', 'leaf'].map(shape => (
                <button
                  key={shape}
                  onClick={() => setEyeShape(shape)}
                  style={{ 
                    flex: 1, padding: '12px', borderRadius: '8px', 
                    border: eyeShape === shape ? '2px solid #2563eb' : '1px solid #cbd5e1', 
                    backgroundColor: eyeShape === shape ? '#eff6ff' : '#fff',
                    cursor: 'pointer', textTransform: 'capitalize', fontWeight: 'bold', color: '#475569'
                  }}
                >
                  {shape}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={hasLogo} 
                onChange={(e) => setHasLogo(e.target.checked)} 
                style={{ width: '20px', height: '20px' }}
              />
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>Embed Logo in Center</span>
            </label>
          </div>

          <button 
            disabled={!isScannable}
            style={{ 
              width: '100%', padding: '16px', backgroundColor: isScannable ? '#0f172a' : '#94a3b8', 
              color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', 
              cursor: isScannable ? 'pointer' : 'not-allowed'
            }}
          >
            Export High-Res PNG
          </button>

        </div>

        {/* Right Side: Live Preview */}
        <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '380px' }}>
            
            {/* Mock QR Code Visual Representation */}
            <div style={{ 
              width: '240px', height: '240px', backgroundColor: '#fff', position: 'relative',
              // Using a repeating linear gradient to fake the "pixels" of a QR code
              backgroundImage: `repeating-linear-gradient(45deg, ${color} 0, ${color} 10px, transparent 10px, transparent 20px), repeating-linear-gradient(135deg, ${color} 0, ${color} 10px, transparent 10px, transparent 20px)`,
              opacity: 0.8
            }}>
              
              {/* QR Eyes */}
              {[
                { top: 0, left: 0 },
                { top: 0, right: 0 },
                { bottom: 0, left: 0 }
              ].map((pos, idx) => (
                <div key={idx} style={{ 
                  position: 'absolute', ...pos, width: '60px', height: '60px', 
                  backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px'
                }}>
                  <div style={{ 
                    width: '100%', height: '100%', border: `6px solid ${color}`, 
                    borderRadius: eyeShape === 'round' ? '50%' : eyeShape === 'leaf' ? '24px 0 24px 0' : '0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <div style={{ 
                      width: '50%', height: '50%', backgroundColor: color,
                      borderRadius: eyeShape === 'round' ? '50%' : eyeShape === 'leaf' ? '12px 0 12px 0' : '0'
                    }} />
                  </div>
                </div>
              ))}

              {/* Center Logo */}
              {hasLogo && (
                <div style={{ 
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  width: '56px', height: '56px', backgroundColor: '#fff', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0',
                  fontSize: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}>
                  👑
                </div>
              )}

            </div>
          </div>

          {/* Validation Status */}
          <div style={{ backgroundColor: isScannable ? '#f0fdf4' : '#fef2f2', border: `1px solid ${isScannable ? '#bbf7d0' : '#fecaca'}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{isScannable ? '✅' : '❌'}</span>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: isScannable ? '#166534' : '#991b1b', fontSize: '14px' }}>
                {isScannable ? 'Scannability: Excellent' : 'Scannability: Critical Error'}
              </h4>
              <p style={{ margin: 0, color: isScannable ? '#15803d' : '#b91c1c', fontSize: '13px' }}>
                {isScannable 
                  ? `Error correction (Level H) supports current logo size and data density.`
                  : `URL is too short or logo is too large for the error correction level.`}
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default CustomQrGenerator;
