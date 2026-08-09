import React, { useState } from 'react';

// Mock AI backend that returns optimized layout tokens based on the creator's niche
const generateLayoutByNiche = async (niche) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const lowerNiche = niche.toLowerCase();
      
      // Default / Tech
      let layout = {
        themeName: 'Cyber Minimalist',
        primaryColor: '#3b82f6', // Blue
        bgColor: '#0f172a', // Dark Slate
        textColor: '#f8fafc',
        fontFamily: '"Fira Code", monospace',
        buttonStyle: { borderRadius: '4px', border: '1px solid #3b82f6', backgroundColor: 'transparent' },
        links: ['Latest YouTube Video', 'My Setup / Gear', 'Sponsorship Inquiries']
      };

      if (lowerNiche.includes('fitness') || lowerNiche.includes('gym')) {
        layout = {
          themeName: 'High Energy',
          primaryColor: '#ef4444', // Red
          bgColor: '#ffffff',
          textColor: '#18181b',
          fontFamily: '"Oswald", sans-serif',
          buttonStyle: { borderRadius: '0px', border: 'none', backgroundColor: '#ef4444', color: '#fff', textTransform: 'uppercase', fontWeight: 'bold' },
          links: ['1-on-1 Coaching', 'Workout Plans', 'My Supplements']
        };
      } else if (lowerNiche.includes('art') || lowerNiche.includes('design')) {
        layout = {
          themeName: 'Studio Canvas',
          primaryColor: '#8b5cf6', // Purple
          bgColor: '#fafaf9',
          textColor: '#44403c',
          fontFamily: '"Playfair Display", serif',
          buttonStyle: { borderRadius: '24px', border: 'none', backgroundColor: '#e7e5e4', color: '#44403c', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
          links: ['Portfolio', 'Commission Me', 'Prints Shop']
        };
      }

      resolve(layout);
    }, 2500); // Simulate 2.5s generation time
  });
};

/**
 * AI-Powered Smart Bio Layout Generator
 * Takes a creator's niche as input and automatically generates
 * an optimized color palette, font pairing, and link hierarchy.
 */
export const SmartBioGenerator = () => {
  const [step, setStep] = useState('input'); // input | generating | preview
  const [niche, setNiche] = useState('');
  const [generatedLayout, setGeneratedLayout] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!niche.trim()) return;
    
    setStep('generating');
    const layout = await generateLayoutByNiche(niche);
    setGeneratedLayout(layout);
    setStep('preview');
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>AI Smart Bio Generator</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
          Stop wrestling with generic templates. Tell us what you do, and our AI will build a highly-optimized, branded bio page layout for you in seconds.
        </p>
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <div style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleGenerate}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>
              What is your creator niche?
            </label>
            <input 
              type="text" 
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. Tech Reviewer, Fitness Coach, 3D Artist"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', marginBottom: '24px', boxSizing: 'border-box', outlineColor: '#3b82f6' }}
              autoFocus
            />
            <button 
              type="submit"
              disabled={!niche.trim()}
              style={{ 
                width: '100%', padding: '14px', backgroundColor: niche.trim() ? '#2563eb' : '#94a3b8', 
                color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: niche.trim() ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s'
              }}
            >
              Generate My Bio Layout ✨
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Generating Animation */}
      {step === 'generating' && (
        <div style={{ textAlign: 'center', padding: '64px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#3b82f6', borderRadius: '4px', animation: 'flip 1.2s infinite ease-in-out' }}>
              <style>{`@keyframes flip { 0% { transform: perspective(120px) rotateX(0deg) rotateY(0deg); } 50% { transform: perspective(120px) rotateX(-180.1deg) rotateY(0deg); } 100% { transform: perspective(120px) rotateX(-180deg) rotateY(-179.9deg); } }`}</style>
            </div>
          </div>
          <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>Designing your layout...</h3>
          <p style={{ color: '#64748b' }}>Matching fonts, generating color palettes, and optimizing link hierarchy for "{niche}".</p>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && generatedLayout && (
        <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
          
          {/* Dashboard Controls / Insights */}
          <div style={{ flex: 1, backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>AI Design Insights</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: '#64748b' }}>Selected Theme</h4>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{generatedLayout.themeName}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: '#64748b' }}>Color Palette</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[generatedLayout.primaryColor, generatedLayout.bgColor, generatedLayout.textColor].map(color => (
                  <div key={color} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color, border: '1px solid #cbd5e1' }} title={color} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: '#64748b' }}>Typography Pairing</h4>
              <p style={{ margin: 0, fontFamily: generatedLayout.fontFamily, fontSize: '16px' }}>{generatedLayout.fontFamily}</p>
            </div>

            <button 
              style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}
            >
              Apply Theme & Continue
            </button>
            <button 
              onClick={() => setStep('input')}
              style={{ width: '100%', padding: '12px', backgroundColor: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Start Over
            </button>
          </div>

          {/* Mobile Phone Mockup Preview */}
          <div style={{ 
            width: '320px', height: '640px', backgroundColor: generatedLayout.bgColor, color: generatedLayout.textColor,
            borderRadius: '40px', border: '8px solid #cbd5e1', padding: '24px', boxSizing: 'border-box',
            fontFamily: generatedLayout.fontFamily, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            
            {/* Fake Notch */}
            <div style={{ width: '100px', height: '20px', backgroundColor: '#cbd5e1', borderRadius: '0 0 12px 12px', position: 'absolute', top: 0 }} />

            <div style={{ width: '96px', height: '96px', borderRadius: '50%', backgroundColor: generatedLayout.primaryColor, marginTop: '20px', marginBottom: '16px' }} />
            
            <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', textAlign: 'center' }}>@CreatorName</h2>
            <p style={{ margin: '0 0 32px 0', fontSize: '14px', textAlign: 'center', opacity: 0.8 }}>
              {niche} • Content Creator
            </p>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {generatedLayout.links.map((link, idx) => (
                <button 
                  key={idx} 
                  style={{
                    width: '100%', padding: '16px', fontSize: '14px', 
                    cursor: 'pointer', fontFamily: 'inherit',
                    ...generatedLayout.buttonStyle
                  }}
                >
                  {link}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SmartBioGenerator;
