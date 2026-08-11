import React, { useState } from 'react';

// Mock data representing the 3 thumbnail variants uploaded by the creator
const mockVariants = [
  { 
    id: 'thumb_a', 
    name: 'Variant A - Minimal Text', 
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80',
    predictedCTR: 0, 
    breakdown: { contrast: 0, textLegibility: 0, emotion: 0 } 
  },
  { 
    id: 'thumb_b', 
    name: 'Variant B - Surprised Face', 
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80',
    predictedCTR: 0, 
    breakdown: { contrast: 0, textLegibility: 0, emotion: 0 } 
  },
  { 
    id: 'thumb_c', 
    name: 'Variant C - High Contrast', 
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=80',
    predictedCTR: 0, 
    breakdown: { contrast: 0, textLegibility: 0, emotion: 0 } 
  }
];

// Mock API simulating a Computer Vision model analyzing the images
const runComputerVisionAnalysis = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { 
          id: 'thumb_a', 
          predictedCTR: 5.2, 
          breakdown: { contrast: 65, textLegibility: 85, emotion: 40 },
          feedback: 'Clean layout, but lacks human emotional hook.'
        },
        { 
          id: 'thumb_b', 
          predictedCTR: 9.8, 
          breakdown: { contrast: 72, textLegibility: 60, emotion: 95 },
          feedback: 'High emotional engagement (surprised face) drives curiosity. Text slightly hard to read.'
        },
        { 
          id: 'thumb_c', 
          predictedCTR: 7.4, 
          breakdown: { contrast: 95, textLegibility: 90, emotion: 20 },
          feedback: 'Excellent contrast and readability, but feels too corporate.'
        }
      ]);
    }, 3000); // 3 second simulated analysis latency
  });
};

/**
 * Predictive Thumbnail A/B Test Simulator
 * Uses simulated Computer Vision to analyze contrast, text legibility,
 * and facial expressions to predict which thumbnail will yield the highest CTR.
 */
export const ThumbnailSimulator = () => {
  const [step, setStep] = useState('upload'); // upload | scanning | results
  const [variants, setVariants] = useState(mockVariants);

  const handleSimulate = async () => {
    setStep('scanning');
    const results = await runComputerVisionAnalysis();
    
    // Merge results with variants
    const merged = variants.map(v => {
      const analysis = results.find(r => r.id === v.id);
      return { ...v, ...analysis };
    });
    
    // Sort so highest CTR is first
    merged.sort((a, b) => b.predictedCTR - a.predictedCTR);
    
    setVariants(merged);
    setStep('results');
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Predictive Thumbnail Simulator</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '700px', margin: '0 auto' }}>
          Stop risking your video's momentum on a bad thumbnail. Upload up to 3 variants before publishing, and our CV model will predict the highest Click-Through Rate based on a billion data points.
        </p>
      </div>

      {/* Step 1: Upload / Ready to Scan */}
      {step === 'upload' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
            {variants.map((variant) => (
              <div key={variant.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ height: '200px', backgroundImage: `url(${variant.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div style={{ padding: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#334155' }}>{variant.name}</h4>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <button 
              onClick={handleSimulate}
              style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '16px 32px', fontSize: '16px', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)' }}
            >
              Run AI Prediction Simulation
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Scanning Animation */}
      {step === 'scanning' && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '64px 20px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '32px' }}>
            {/* Pulsing indicator dots */}
            {[1, 2, 3].map(i => (
              <div key={i} style={{ 
                width: '16px', height: '16px', backgroundColor: '#3b82f6', borderRadius: '50%',
                animation: `bounce 1.4s infinite ease-in-out both`, animationDelay: `${i * 0.16}s`
              }}>
                <style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }`}</style>
              </div>
            ))}
          </div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '24px' }}>Running Computer Vision Models...</h3>
          <p style={{ color: '#64748b', fontSize: '15px' }}>Analyzing facial geometry, color contrast, and OCR text legibility.</p>
        </div>
      )}

      {/* Step 3: Results Display */}
      {step === 'results' && (
        <div>
          {/* Winner Banner */}
          <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '16px', padding: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏆 Predicted Winner: {variants[0].name}
              </h3>
              <p style={{ margin: 0, color: '#15803d', fontSize: '15px' }}>
                This variant is projected to outperform the others by generating a <strong>{variants[0].predictedCTR}% CTR</strong>.
              </p>
            </div>
            <div style={{ backgroundColor: '#166534', color: '#ffffff', padding: '12px 24px', borderRadius: '12px', fontSize: '24px', fontWeight: '900' }}>
              {variants[0].predictedCTR}%
            </div>
          </div>

          {/* Breakdown Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {variants.map((variant, idx) => (
              <div key={variant.id} style={{ 
                backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', 
                border: idx === 0 ? '2px solid #22c55e' : '1px solid #e2e8f0', 
                boxShadow: idx === 0 ? '0 10px 15px -3px rgba(34, 197, 94, 0.2)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
                position: 'relative'
              }}>
                
                {/* Rank Badge */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: '#0f172a', color: '#ffffff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', zIndex: 10 }}>
                  Rank #{idx + 1}
                </div>

                <div style={{ height: '180px', backgroundImage: `url(${variant.image})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                  {/* Overlay shadow for text contrast */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', color: '#ffffff', fontWeight: 'bold', fontSize: '24px' }}>
                    {variant.predictedCTR}% CTR
                  </div>
                </div>
                
                <div style={{ padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>{variant.name}</h4>
                  
                  {/* Breakdown Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { label: 'Color Contrast', value: variant.breakdown.contrast },
                      { label: 'Text Legibility', value: variant.breakdown.textLegibility },
                      { label: 'Facial Emotion', value: variant.breakdown.emotion }
                    ].map(metric => (
                      <div key={metric.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
                          <span>{metric.label}</span>
                          <span style={{ color: getScoreColor(metric.value) }}>{metric.value}/100</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${metric.value}%`, height: '100%', backgroundColor: getScoreColor(metric.value) }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Feedback */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${idx === 0 ? '#22c55e' : '#94a3b8'}` }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontStyle: 'italic', lineHeight: '1.5' }}>
                      {variant.feedback}
                    </p>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <button 
              onClick={() => setStep('upload')}
              style={{ background: 'none', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}
            >
              Test New Variants
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ThumbnailSimulator;
