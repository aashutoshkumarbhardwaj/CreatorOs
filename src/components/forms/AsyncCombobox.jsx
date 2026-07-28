import React, { useState, useEffect, useRef } from 'react';

/**
 * AsyncCombobox
 * An accessible Autocomplete (Combobox) component that fetches results dynamically 
 * and handles complex WAI-ARIA keyboard navigation.
 * 
 * @param {Function} fetchOptions - Async function (query) => Promise<Array<{value, label}>>
 * @param {Function} onSelect - Callback fired when an option is selected
 * @param {string} placeholder - Input placeholder text
 */
const AsyncCombobox = ({ fetchOptions, onSelect, placeholder = 'Search...' }) => {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const inputRef = useRef(null);
  const listboxRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // 1. Debounced API Search Logic
  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      setIsOpen(false);
      return;
    }

    // Clear the previous timer if user is still typing
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Wait 300ms before triggering the search
    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);
      setIsOpen(true);
      
      try {
        const results = await fetchOptions(query);
        setOptions(results || []);
        setActiveIndex(-1); // Reset focus index when new results arrive
      } catch (error) {
        console.error('Error fetching combobox options:', error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimerRef.current);
  }, [query, fetchOptions]);

  // 2. Click outside handler
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        listboxRef.current && !listboxRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3. Strict WAI-ARIA Keyboard Navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      // Open the dropdown if user presses down arrow while focused
      if (e.key === 'ArrowDown' && options.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < options.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < options.length) {
          handleSelect(options[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus(); // Return focus to input
        break;
      default:
        break;
    }
  };

  // Scroll active item into view when navigating via keyboard
  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeElement = listboxRef.current.children[activeIndex];
      if (activeElement) {
        // Prevent scrolling the whole page by using block: nearest
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleSelect = (option) => {
    setQuery(option.label); // Update input visually
    setIsOpen(false);
    setActiveIndex(-1);
    if (onSelect) onSelect(option);
  };

  // 4. Highlight matching substring
  const renderHighlightedText = (text, highlight) => {
    if (!highlight.trim()) return text;
    
    // Create a case-insensitive regex to find the matching substring
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) 
        ? <strong key={i} style={{ color: '#2563eb', fontWeight: 'bold' }}>{part}</strong> 
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', fontFamily: 'system-ui, sans-serif' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query && options.length > 0) setIsOpen(true); }}
        placeholder={placeholder}
        
        /* WAI-ARIA Accessibility Attributes */
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="cb-listbox"
        aria-activedescendant={activeIndex >= 0 ? `cb-option-${activeIndex}` : undefined}
        
        style={{
          width: '100%',
          padding: '12px 16px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          outlineColor: '#3b82f6',
          fontSize: '15px',
          color: '#1e293b',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box'
        }}
      />

      {isOpen && (
        <ul
          id="cb-listbox"
          ref={listboxRef}
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '8px',
            padding: '8px 0',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            maxHeight: '260px',
            overflowY: 'auto',
            zIndex: 1000,
            listStyle: 'none',
            marginBlockStart: 0,
            marginBlockEnd: 0
          }}
        >
          {isLoading ? (
            <li style={{ padding: '12px 20px', color: '#64748b', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '14px', 
                height: '14px', 
                border: '2px solid #e2e8f0', 
                borderTopColor: '#3b82f6', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
              }}>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </span>
              Searching...
            </li>
          ) : options.length === 0 ? (
            <li style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '14px' }}>
              No results found for "{query}"
            </li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.value}
                id={`cb-option-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  padding: '10px 20px',
                  cursor: 'pointer',
                  backgroundColor: activeIndex === index ? '#f1f5f9' : 'transparent',
                  color: '#334155',
                  fontSize: '14px',
                  transition: 'background-color 0.1s'
                }}
              >
                {renderHighlightedText(option.label, query)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default AsyncCombobox;
