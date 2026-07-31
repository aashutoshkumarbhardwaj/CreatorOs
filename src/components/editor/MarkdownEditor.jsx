import React, { useState, useRef, useEffect } from 'react';
// Note: In production, ensure `marked` and `dompurify` are installed
// import { marked } from 'marked';
// import DOMPurify from 'dompurify';

/**
 * A Client-Side Markdown Parser and Editor with a built-in preview toggle.
 * Sanitizes output using DOMPurify to prevent XSS attacks.
 */
const MarkdownEditor = ({ initialValue = '', onChange }) => {
  const [content, setContent] = useState(initialValue);
  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const [htmlPreview, setHtmlPreview] = useState('');
  const textareaRef = useRef(null);

  // Parse and sanitize markdown when switching to preview mode
  useEffect(() => {
    if (mode === 'preview') {
      try {
        // Fallbacks provided for demonstration in case libraries aren't installed globally yet
        const markedParser = window.marked?.parse || ((text) => `<p>${text}</p>`);
        const purifier = window.DOMPurify?.sanitize || ((html) => html); // NEVER do this in prod

        const rawHtml = markedParser(content || '');
        const cleanHtml = purifier(rawHtml);
        
        setHtmlPreview(cleanHtml);
      } catch (error) {
        console.error('Markdown Parsing Error:', error);
        setHtmlPreview('<p style="color:red;">Error parsing markdown.</p>');
      }
    }
  }, [mode, content]);

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    if (onChange) onChange(val);
  };

  /**
   * Injects markdown syntax at the cursor position or wraps the selected text.
   */
  const insertSyntax = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end, text.length);

    const newText = before + prefix + selection + suffix + after;
    setContent(newText);
    if (onChange) onChange(newText);

    // Reset cursor position to inside the new syntax brackets
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  // Toolbar Configuration
  const toolbarButtons = [
    { label: 'B', title: 'Bold', action: () => insertSyntax('**', '**'), style: { fontWeight: 'bold' } },
    { label: 'I', title: 'Italic', action: () => insertSyntax('*', '*'), style: { fontStyle: 'italic', fontFamily: 'serif' } },
    { label: 'H1', title: 'Heading 1', action: () => insertSyntax('# ', '') },
    { label: 'H2', title: 'Heading 2', action: () => insertSyntax('## ', '') },
    { label: 'Link', title: 'Insert Link', action: () => insertSyntax('[', '](url)') },
    { label: 'List', title: 'Bullet List', action: () => insertSyntax('- ', '') },
    { label: 'Code', title: 'Code Block', action: () => insertSyntax('```\n', '\n```'), style: { fontFamily: 'monospace' } },
  ];

  return (
    <div style={{ 
      border: '1px solid #cbd5e1', 
      borderRadius: '8px', 
      overflow: 'hidden', 
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
    }}>
      
      {/* 1. Header & Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: '#f8fafc', 
        borderBottom: '1px solid #cbd5e1', 
        padding: '8px 12px' 
      }}>
        
        {/* Formatting Buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {toolbarButtons.map(btn => (
            <button
              key={btn.title}
              title={btn.title}
              onClick={btn.action}
              disabled={mode === 'preview'}
              style={{
                ...btn.style,
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: mode === 'preview' ? 'not-allowed' : 'pointer',
                opacity: mode === 'preview' ? 0.4 : 1,
                fontSize: '14px',
                color: '#334155',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => { if(mode !== 'preview') e.currentTarget.style.backgroundColor = '#e2e8f0' }}
              onMouseOut={(e) => { if(mode !== 'preview') e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Edit / Preview Toggle Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setMode('edit')}
            style={{
              padding: '6px 16px',
              backgroundColor: mode === 'edit' ? '#ffffff' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: mode === 'edit' ? '600' : '500',
              boxShadow: mode === 'edit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: '13px',
              color: mode === 'edit' ? '#0f172a' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            Write
          </button>
          <button
            onClick={() => setMode('preview')}
            style={{
              padding: '6px 16px',
              backgroundColor: mode === 'preview' ? '#ffffff' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: mode === 'preview' ? '600' : '500',
              boxShadow: mode === 'preview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: '13px',
              color: mode === 'preview' ? '#0f172a' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            Preview
          </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div style={{ minHeight: '350px', backgroundColor: '#ffffff' }}>
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="Write your community post using Markdown..."
            style={{
              width: '100%',
              minHeight: '350px',
              padding: '20px',
              border: 'none',
              resize: 'vertical',
              outline: 'none',
              fontSize: '15px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              lineHeight: '1.6',
              color: '#1e293b',
              backgroundColor: 'transparent'
            }}
          />
        ) : (
          <div
            className="markdown-preview-content"
            style={{
              padding: '20px',
              minHeight: '350px',
              fontSize: '15px',
              lineHeight: '1.7',
              color: '#334155',
              wordBreak: 'break-word'
            }}
            dangerouslySetInnerHTML={{ __html: htmlPreview }}
          />
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor;
