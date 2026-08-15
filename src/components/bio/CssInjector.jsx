import React, { useState, useEffect } from 'react';

/**
 * Custom CSS Injector for Smart Bios
 * Gives developer-creators absolute, pixel-perfect control over their bio aesthetics
 * by allowing them to inject and preview raw CSS overrides in real-time.
 */
export const CssInjector = () => {
  const defaultCSS = `/* 
 * Advanced Customization
 * Target the specific classes below to override the default theme.
 */

.bio-background {
  background: linear-gradient(135deg, #0f172a 0%, #312e81 100%);
}

.bio-avatar {
  border: 4px solid #818cf8;
  box-shadow: 0 0 20px rgba(129, 140, 248, 0.4);
}

.bio-link-btn {
  background-color: transparent;
  border: 2px solid #6366f1;
  color: #c7d2fe;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.bio-link-btn:hover {
  background-color: #6366f1;
  color: #ffffff;
  transform: translateY(-4px);
}
`;

  const [cssCode, setCssCode] = useState(defaultCSS);
  const [sanitizedCSS, setSanitizedCSS] = useState(defaultCSS);
  const [error, setError] = useState(null);

  // Mock CSS Sanitization Engine
  useEffect(() => {
    const validateCSS = setTimeout(() => {
      // Basic mock check for malicious expressions
      if (cssCode.includes('javascript:') || cssCode.includes('expression(') || cssCode.includes('<script>')) {
        setError('Malicious code detected. Injection blocked.');
        setSanitizedCSS('');
      } else {
        setError(null);
        setSanitizedCSS(cssCode);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(validateCSS);
  }, [cssCode]);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      {/* Injecting the sanitized CSS into the document head just for the preview scoped to .bio-preview-container */}
      <style>{`
        .bio-preview-container .bio-background { background: #f8fafc; }
        .bio-preview-container .bio-avatar { width: 96px; height: 96px; border-radius: 50%; background-color: #cbd5e1; margin: 0 auto 16px; }
        .bio-preview-container .bio-link-btn { width: 100%; padding: 16px; margin-bottom: 12px; font-weight: bold; cursor: pointer; border: none; background: #e2e8f0; border-radius: 8px; }
        
        /* Apply User's Custom CSS */
        ${sanitizedCSS.replace(/\.bio-/g, '.bio-preview-container .bio-')}
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Advanced CSS Injector</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '700px', margin: '0 auto' }}>
          Standard themes too restrictive? Write your own raw CSS to gain pixel-perfect control over your bio page's borders, gradients, and hover animations.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '32px', height: '600px' }}>
        
        {/* Left Side: Code Editor */}
        <div style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#38bdf8' }}>#</span> custom_theme.css
            </span>
            <button style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              Save & Publish
            </button>
          </div>
          
          <textarea 
            value={cssCode}
            onChange={(e) => setCssCode(e.target.value)}
            spellCheck="false"
            style={{ 
              flex: 1, padding: '24px', backgroundColor: 'transparent', color: '#e2e8f0', 
              fontFamily: '"Fira Code", monospace', fontSize: '14px', lineHeight: '1.6',
              border: 'none', resize: 'none', outline: 'none'
            }}
          />

          {error && (
            <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '12px 24px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* Right Side: Live Preview */}
        <div style={{ 
          width: '340px', backgroundColor: '#e2e8f0', borderRadius: '40px', border: '8px solid #cbd5e1', 
          boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative', overflow: 'hidden'
        }}>
          {/* Fake Notch */}
          <div style={{ width: '100px', height: '24px', backgroundColor: '#cbd5e1', borderRadius: '0 0 16px 16px', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} />

          {/* Actual Bio Preview Container where styles are applied */}
          <div className="bio-preview-container bio-background" style={{ width: '100%', height: '100%', padding: '64px 24px 24px', boxSizing: 'border-box', transition: 'all 0.3s ease' }}>
            
            <div style={{ textAlign: 'center' }}>
              <div className="bio-avatar" style={{ transition: 'all 0.3s ease' }}></div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#f8fafc' }}>@DevCreator</h3>
              <p style={{ margin: '0 0 32px 0', fontSize: '14px', color: '#94a3b8' }}>Software Engineer</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button className="bio-link-btn">My GitHub</button>
              <button className="bio-link-btn">Latest Tech Setup</button>
              <button className="bio-link-btn">Sponsor My Open Source</button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default CssInjector;
