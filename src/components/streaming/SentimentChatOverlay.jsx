import React, { useState, useEffect, useRef } from 'react';

// Mock data generator for incoming multi-stream chat messages
const generateMockMessage = () => {
  const platforms = ['youtube', 'twitch'];
  const platform = platforms[Math.floor(Math.random() * platforms.length)];
  
  const sentiments = [
    { type: 'excited', score: 0.9, text: 'OMG this is INSANE!!! 🔥' },
    { type: 'excited', score: 0.8, text: 'Woooo let\'s goooo' },
    { type: 'angry', score: -0.7, text: 'Why is the stream lagging? Fix your internet 😡' },
    { type: 'angry', score: -0.9, text: 'This is the worst gameplay I\'ve ever seen.' },
    { type: 'confused', score: 0.1, text: 'Wait, what just happened?' },
    { type: 'confused', score: 0.2, text: 'How did you do that jump??' },
    { type: 'neutral', score: 0, text: 'Hello from Brazil' },
    { type: 'neutral', score: 0, text: 'I am eating a sandwich.' }
  ];

  const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
  const users = ['ProGamer', 'ChillViewer99', 'xX_Sniper_Xx', 'NoobMaster', 'FanGirl23'];
  const user = users[Math.floor(Math.random() * users.length)];

  return {
    id: Math.random().toString(36).substring(2, 9),
    user,
    text: sentiment.text,
    platform,
    sentiment: sentiment.type,
    sentimentScore: sentiment.score, // NLP scale from -1 to 1
    timestamp: new Date()
  };
};

/**
 * SentimentChatOverlay
 * A unified chat component that aggregates multi-platform streams (YouTube, Twitch)
 * and utilizes Natural Language Processing to provide real-time audience mood analytics.
 */
export const SentimentChatOverlay = () => {
  const [messages, setMessages] = useState([]);
  const [overallSentiment, setOverallSentiment] = useState({ score: 0, label: 'Neutral' });
  const [trendingKeywords, setTrendingKeywords] = useState(['lag', 'gameplay', 'how']);
  
  const chatEndRef = useRef(null);

  // Simulate a live websocket connection pumping in chat messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => {
        const newMsg = generateMockMessage();
        // Maintain a rolling window of the last 50 messages for NLP processing
        const updated = [...prev, newMsg].slice(-50); 
        return updated;
      });
    }, 1500); // 1.5 seconds per message simulation
    
    return () => clearInterval(interval);
  }, []);

  // Recalculate macro sentiment whenever the chat buffer updates
  useEffect(() => {
    if (messages.length === 0) return;

    // Calculate moving average of sentiment scores
    const totalScore = messages.reduce((acc, msg) => acc + msg.sentimentScore, 0);
    const avgScore = totalScore / messages.length;
    
    // Determine macro label
    let label = 'Neutral';
    if (avgScore > 0.3) label = 'Excited';
    else if (avgScore < -0.3) label = 'Angry';
    else if (messages.filter(m => m.sentiment === 'confused').length > messages.length * 0.3) {
      // If 30% of the rolling buffer is confused, flag the stream
      label = 'Confused';
    }

    setOverallSentiment({ score: avgScore, label });

    // Auto-scroll chat terminal
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Determine UI colors based on emotional state
  const getMeterColor = (label) => {
    switch (label) {
      case 'Excited': return '#10b981'; // Green
      case 'Angry': return '#ef4444'; // Red
      case 'Confused': return '#f59e0b'; // Amber
      default: return '#94a3b8'; // Slate Gray
    }
  };

  // Map the -1 to +1 score to a 0% to 100% UI progress bar width
  const meterWidth = Math.max(10, Math.min(100, ((overallSentiment.score + 1) / 2) * 100));

  return (
    <div style={{ display: 'flex', gap: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* 1. Raw Unified Chat Stream (Dark Mode for Streamers) */}
      <div style={{ 
        flex: 1, backgroundColor: '#0f172a', borderRadius: '16px', overflow: 'hidden', 
        display: 'flex', flexDirection: 'column', height: '600px', border: '1px solid #1e293b',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' 
      }}>
        <div style={{ padding: '16px 20px', backgroundColor: '#1e293b', borderBottom: '1px solid #0f172a', color: '#f8fafc', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>Unified Live Chat</span>
          <span style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>🔴 YouTube</span>
            <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>🟣 Twitch</span>
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: '12px', fontSize: '15px', lineHeight: '1.4' }}>
              <span style={{ fontSize: '18px' }}>{msg.platform === 'youtube' ? '🔴' : '🟣'}</span>
              <div>
                <strong style={{ 
                  color: msg.sentiment === 'angry' ? '#fca5a5' : 
                         msg.sentiment === 'excited' ? '#6ee7b7' : 
                         msg.sentiment === 'confused' ? '#fde047' : '#bae6fd' 
                }}>
                  {msg.user}
                </strong>
                <span style={{ color: '#e2e8f0', marginLeft: '8px' }}>{msg.text}</span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* 2. Real-Time NLP Analytics Dashboard (Light Mode overlay panels) */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Sentiment Meter Panel */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Audience Mood
          </h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '15px', fontWeight: 'bold', color: getMeterColor(overallSentiment.label) }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{overallSentiment.label}</span>
            <span>{Math.round(meterWidth)}%</span>
          </div>
          
          {/* Progress Bar Container */}
          <div style={{ width: '100%', height: '16px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ 
              width: `${meterWidth}%`, 
              height: '100%', 
              backgroundColor: getMeterColor(overallSentiment.label),
              transition: 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
            }} />
          </div>
          <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
            Derived from NLP processing of the most recent 50 cross-platform messages.
          </p>
        </div>

        {/* Trending Keywords Extraction Panel */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Trending Topics</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>Most discussed phrases in the last 2 minutes.</p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {trendingKeywords.map(keyword => (
              <span key={keyword} style={{ 
                backgroundColor: '#f8fafc', padding: '8px 14px', 
                borderRadius: '20px', fontSize: '14px', fontWeight: '500', 
                color: '#334155', border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                #{keyword}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SentimentChatOverlay;
