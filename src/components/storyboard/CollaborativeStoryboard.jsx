import React, { useState, useEffect, useRef } from 'react';

/**
 * Mock multiplayer cursor data simulating other team members
 * (e.g., Editor, Scriptwriter) moving around the canvas in real-time.
 */
const MOCK_MULTIPLAYER_CURSORS = [
  { id: 'u1', name: 'Sarah (Editor)', color: '#ec4899', x: 200, y: 150 },
  { id: 'u2', name: 'Mike (Writer)', color: '#3b82f6', x: 600, y: 400 }
];

const INITIAL_SCENES = [
  { 
    id: 'scene_1', 
    title: 'The Hook (0:00 - 0:15)', 
    script: 'Are you tired of spending 10 hours a day managing sponsorships? What if I told you there was a better way?', 
    bRoll: ['Wide shot of messy desk', 'Close up of frustrated face'],
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300&q=80',
    comments: 1
  },
  { 
    id: 'scene_2', 
    title: 'Introducing the Solution (0:15 - 1:00)', 
    script: 'Enter CreatorOS. The only unified platform that handles your media kit, analytics, and CRM in one place.', 
    bRoll: ['Screen recording of dashboard', 'Smooth pan over laptop'],
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=300&q=80',
    comments: 0
  }
];

/**
 * CollaborativeStoryboard
 * An interactive, multiplayer canvas where creators, writers, and editors
 * can align on script, B-Roll, and visual references prior to filming.
 */
export const CollaborativeStoryboard = () => {
  const [scenes, setScenes] = useState(INITIAL_SCENES);
  const [cursors, setCursors] = useState(MOCK_MULTIPLAYER_CURSORS);
  const [activeCommentScene, setActiveCommentScene] = useState(null);
  const boardRef = useRef(null);

  // Simulate remote cursors moving organically
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors(prev => prev.map(c => ({
        ...c,
        x: Math.max(0, Math.min(800, c.x + (Math.random() - 0.5) * 50)),
        y: Math.max(0, Math.min(600, c.y + (Math.random() - 0.5) * 50))
      })));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddScene = () => {
    const newScene = {
      id: `scene_${Date.now()}`,
      title: 'New Scene',
      script: '',
      bRoll: [],
      image: '',
      comments: 0
    };
    setScenes([...scenes, newScene]);
  };

  const updateScene = (id, field, value) => {
    setScenes(scenes.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleAddBRoll = (id, e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      const targetScene = scenes.find(s => s.id === id);
      updateScene(id, 'bRoll', [...targetScene.bRoll, e.target.value.trim()]);
      e.target.value = '';
    }
  };

  const removeBRoll = (sceneId, tagIndex) => {
    const targetScene = scenes.find(s => s.id === sceneId);
    updateScene(sceneId, 'bRoll', targetScene.bRoll.filter((_, i) => i !== tagIndex));
  };

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Top Navigation / Toolbar */}
      <div style={{ maxWidth: '1200px', margin: '0 auto 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#0f172a' }}>Collaborative Storyboard</h2>
          <p style={{ margin: 0, color: '#64748b' }}>Project: "The Future of Creator Tools" • 3 Active Users</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleAddScene}
            style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Add Scene Block
          </button>
          <button style={{ padding: '10px 20px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            Export to PDF
          </button>
        </div>
      </div>

      {/* The Interactive Canvas Area */}
      <div 
        ref={boardRef}
        style={{ 
          maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '24px', 
          overflowX: 'auto', paddingBottom: '40px', position: 'relative' 
        }}
      >
        
        {/* Render Fake Multiplayer Cursors */}
        {cursors.map(cursor => (
          <div 
            key={cursor.id} 
            style={{
              position: 'absolute',
              left: cursor.x,
              top: cursor.y,
              pointerEvents: 'none',
              zIndex: 50,
              transition: 'all 1s linear' // smooth interpolation of movement
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={cursor.color} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.42c.45 0 .67-.54.35-.85L6.35 3.21a.5.5 0 00-.85.35z"/>
            </svg>
            <div style={{ backgroundColor: cursor.color, color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', marginTop: '4px', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              {cursor.name}
            </div>
          </div>
        ))}

        {/* Scene Cards */}
        {scenes.map((scene, idx) => (
          <div 
            key={scene.id} 
            style={{ 
              minWidth: '350px', backgroundColor: '#ffffff', borderRadius: '12px', 
              border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex', flexDirection: 'column'
            }}
          >
            {/* Header: Scene Title & Drag Handle */}
            <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
              <input 
                type="text" 
                value={scene.title}
                onChange={(e) => updateScene(scene.id, 'title', e.target.value)}
                style={{ border: 'none', backgroundColor: 'transparent', fontWeight: 'bold', fontSize: '15px', color: '#0f172a', width: '100%', outline: 'none' }}
                placeholder="Scene Title..."
              />
              <span style={{ cursor: 'grab', color: '#94a3b8' }}>⋮⋮</span>
            </div>

            {/* Visual Reference / Moodboard Image */}
            <div style={{ height: '180px', backgroundColor: '#e2e8f0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {scene.image ? (
                <img src={scene.image} alt="Reference" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>Drop visual reference here</span>
              )}
            </div>

            {/* Script Editor Block */}
            <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: '#64748b' }}>Script / Dialogue</p>
              <textarea 
                value={scene.script}
                onChange={(e) => updateScene(scene.id, 'script', e.target.value)}
                placeholder="Write the script here..."
                style={{ 
                  width: '100%', height: '100px', padding: '8px', border: '1px solid #e2e8f0', 
                  borderRadius: '6px', fontSize: '14px', resize: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit', outlineColor: '#3b82f6'
                }}
              />
            </div>

            {/* B-Roll Tagging System */}
            <div style={{ padding: '16px', flex: 1 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: '#64748b' }}>B-Roll Needs</p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {scene.bRoll.map((tag, i) => (
                  <span key={i} style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {tag}
                    <button onClick={() => removeBRoll(scene.id, i)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#92400e', fontSize: '14px' }}>×</button>
                  </span>
                ))}
              </div>
              
              <input 
                type="text" 
                placeholder="Add B-Roll shot + Enter"
                onKeyDown={(e) => handleAddBRoll(scene.id, e)}
                style={{ width: '100%', padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', outlineColor: '#3b82f6' }}
              />
            </div>

            {/* Footer / Comment Thread */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                onClick={() => setActiveCommentScene(scene.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: '13px', fontWeight: '600', padding: 0 }}
              >
                💬 {scene.comments} Comments
              </button>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Scene {idx + 1}</span>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollaborativeStoryboard;
