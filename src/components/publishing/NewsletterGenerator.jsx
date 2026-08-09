import React, { useState } from 'react';

// Mock list of recent videos available for conversion
const recentVideos = [
  { id: 'v1', title: 'Why I Stopped Using Next.js', published: '2 days ago', duration: '14:20' },
  { id: 'v2', title: 'My $10,000 Desk Setup Tour', published: '1 week ago', duration: '08:45' },
  { id: 'v3', title: 'The Ultimate Guide to React in 2026', published: '2 weeks ago', duration: '45:10' }
];

// Mock AI backend converting the raw VTT transcript into a readable newsletter
const generateNewsletterDraft = async (videoTitle) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`Hi everyone,

This week on the channel, I broke down a controversial topic: **${videoTitle}**.

Here are the 3 biggest takeaways if you didn't have time to watch the full video:

1. **The Hidden Costs:** We explored the architectural trade-offs that nobody talks about until they get their first massive serverless bill.
2. **Developer Experience:** While the initial setup is fast, maintaining a monolithic structure at scale introduced severe friction for my team.
3. **The Alternative Stack:** I revealed the exact lightweight stack we migrated to, saving us thousands of dollars a month without sacrificing performance.

If you are currently building a new web application, you *need* to see this breakdown before you lock in your tech stack.

[👉 Click here to watch the full video on YouTube]

Hit reply and let me know your thoughts—do you agree with my assessment, or am I totally off-base?

Best,
Alex`);
    }, 2500); // 2.5s simulation of LLM generation
  });
};

/**
 * Newsletter Generator
 * Automatically converts a video transcript into a well-formatted, 
 * ready-to-send newsletter to help creators build algorithm-independent email lists.
 */
export const NewsletterGenerator = () => {
  const [step, setStep] = useState('select'); // select | generating | edit
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [draftContent, setDraftContent] = useState('');

  const handleGenerate = async (video) => {
    setSelectedVideo(video);
    setStep('generating');
    
    const draft = await generateNewsletterDraft(video.title);
    setDraftContent(draft);
    setStep('edit');
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', margin: '0 0 8px 0' }}>AI Newsletter Generator</h2>
        <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
          Turn your latest video into a high-converting email newsletter in seconds. Own your audience.
        </p>
      </div>

      {/* Step 1: Select Video */}
      {step === 'select' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Select a Recent Video</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentVideos.map(video => (
              <div 
                key={video.id} 
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0',
                  transition: 'border-color 0.2s, background-color 0.2s'
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0f172a' }}>{video.title}</h4>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Published {video.published} • {video.duration}</span>
                </div>
                <button 
                  onClick={() => handleGenerate(video)}
                  style={{ 
                    backgroundColor: '#0f172a', color: '#ffffff', border: 'none', 
                    padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' 
                  }}
                >
                  Generate Draft ⚡
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Generating State */}
      {step === 'generating' && (
        <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '64px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'bounce 1s infinite alternate' }}>
            <style>{`@keyframes bounce { from { transform: translateY(0px); } to { transform: translateY(-15px); } }`}</style>
            📝
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Writing your Newsletter...</h3>
          <p style={{ color: '#64748b' }}>Scrubbing the transcript for {selectedVideo?.title} and extracting key takeaways.</p>
        </div>
      )}

      {/* Step 3: Editor / Review State */}
      {step === 'edit' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          
          {/* Email Editor UI */}
          <div style={{ flex: 2, backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            
            <div style={{ backgroundColor: '#f8fafc', padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                <span style={{ width: '40px', color: '#64748b', fontSize: '13px', fontWeight: 'bold' }}>To:</span>
                <div style={{ backgroundColor: '#e2e8f0', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', color: '#334155' }}>
                  All Subscribers (12,405)
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ width: '40px', color: '#64748b', fontSize: '13px', fontWeight: 'bold' }}>Subject:</span>
                <input 
                  type="text" 
                  defaultValue={`The truth about ${selectedVideo?.title}`}
                  style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outlineColor: '#3b82f6' }}
                />
              </div>
            </div>

            <textarea 
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              style={{ 
                width: '100%', height: '400px', padding: '24px', border: 'none', 
                fontSize: '15px', lineHeight: '1.6', color: '#334155', resize: 'none',
                boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Action Sidebar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a' }}>Publish Options</h4>
              
              <button style={{ width: '100%', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>
                Send to Mailchimp
              </button>
              
              <button style={{ width: '100%', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>
                Copy to Clipboard
              </button>
              
              <button 
                onClick={() => setStep('select')}
                style={{ background: 'none', border: 'none', width: '100%', color: '#64748b', cursor: 'pointer', fontWeight: '500', padding: '8px' }}
              >
                Cancel
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default NewsletterGenerator;
