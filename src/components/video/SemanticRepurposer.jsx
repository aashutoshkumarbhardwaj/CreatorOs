import React, { useState } from 'react';

/**
 * Mock API representing the heavy AI backend.
 * In a real environment, this triggers a webhook to a cloud service (e.g., AWS Elemental, 
 * or OpenAI Whisper + Video processing) which transcodes and identifies semantic spikes.
 */
const analyzeVideo = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { 
          id: 1, 
          title: 'The hidden cost of React Hooks', 
          start: '12:45', end: '13:30', duration: '45s', 
          viralScore: 94, 
          hookTranscript: 'Why your useEffect is quietly crashing your entire application...' 
        },
        { 
          id: 2, 
          title: 'Stop using Redux for this', 
          start: '28:10', end: '29:05', duration: '55s', 
          viralScore: 88, 
          hookTranscript: 'You are probably using Redux completely wrong. Here is why.' 
        },
        { 
          id: 3, 
          title: 'Next.js 15 Leaks', 
          start: '45:00', end: '45:50', duration: '50s', 
          viralScore: 82, 
          hookTranscript: 'Next.js just leaked a feature that changes everything for frontend.' 
        }
      ]);
    }, 2500); // Simulate heavy AI analysis latency
  });
};

/**
 * Semantic Content Repurposing Pipeline
 * Allows creators to ingest a 1-hour VOD and automatically generate
 * high-retention vertical clips for TikTok/Shorts based on NLP and audio spikes.
 */
export const SemanticRepurposer = () => {
  const [step, setStep] = useState('upload'); // 'upload' | 'processing' | 'results'
  const [clips, setClips] = useState([]);

  const handleStartAnalysis = async () => {
    setStep('processing');
    const generatedClips = await analyzeVideo();
    setClips(generatedClips);
    setStep('results');
  };

  const handleExport = (clipId) => {
    alert(`Exporting Clip ID ${clipId} to TikTok/Shorts rendering queue...`);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '28px' }}>AI Content Repurposer</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '16px' }}>Turn a 2-hour podcast into a month of TikToks in 60 seconds.</p>
      </div>

      {/* Step 1: Upload State */}
      {step === 'upload' && (
        <div 
          style={{ 
            border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '64px 20px', 
            textAlign: 'center', backgroundColor: '#f8fafc', cursor: 'pointer',
            transition: 'border-color 0.2s, background-color 0.2s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#eff6ff'; }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
          onClick={handleStartAnalysis}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎞️</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Select Long-Form Source Video</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Click to select a recent stream or upload an MP4 file.</p>
        </div>
      )}

      {/* Step 2: Processing State */}
      {step === 'processing' && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '64px 20px', textAlign: 'center', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            {/* Custom pulse animation representing AI scanning */}
            <div style={{ width: '48px', height: '48px', backgroundColor: '#3b82f6', borderRadius: '50%', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}>
              <style>{`@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }`}</style>
            </div>
          </div>
          <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Running Semantic Analysis...</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Transcribing audio, detecting volume spikes, and identifying high-retention hooks.
          </p>
          
          {/* Fake Progress Bar */}
          <div style={{ width: '60%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', margin: '24px auto 0', overflow: 'hidden' }}>
            <div style={{ width: '65%', height: '100%', backgroundColor: '#3b82f6', animation: 'load 2.5s ease-in-out' }}>
               <style>{`@keyframes load { 0% { width: 0%; } 100% { width: 100%; } }`}</style>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Results State */}
      {step === 'results' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>Suggested Viral Clips</h3>
            <button 
              onClick={() => setStep('upload')}
              style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', color: '#475569' }}
            >
              Analyze Another Video
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {clips.map(clip => (
              <div 
                key={clip.id} 
                style={{ 
                  display: 'flex', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', 
                  borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                {/* Visual Thumbnail Placeholder (Vertical Ratio 9:16) */}
                <div style={{ width: '120px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 'bold', fontSize: '12px', padding: '16px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  Preview<br/>(9:16)
                </div>
                
                <div style={{ flex: 1, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {clip.title}
                      <span style={{ fontSize: '12px', backgroundColor: clip.viralScore > 90 ? '#fef08a' : '#e0e7ff', color: clip.viralScore > 90 ? '#854d0e' : '#3730a3', padding: '4px 10px', borderRadius: '12px' }}>
                        {clip.viralScore} Viral Score
                      </span>
                    </h4>
                    
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '13px', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>⏱ {clip.start} - {clip.end} ({clip.duration})</span>
                    </div>

                    <p style={{ margin: 0, fontSize: '14px', color: '#334155', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #cbd5e1' }}>
                      "{clip.hookTranscript}"
                    </p>
                  </div>

                  <button 
                    onClick={() => handleExport(clip.id)}
                    style={{ 
                      backgroundColor: '#2563eb', color: 'white', border: 'none', 
                      padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', 
                      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
                  >
                    Export to Shorts
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default SemanticRepurposer;
