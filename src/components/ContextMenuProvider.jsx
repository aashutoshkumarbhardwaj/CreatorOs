import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Context to allow child components to programmatically close the menu if needed
const ContextMenuContext = createContext(null);
export const useContextMenu = () => useContext(ContextMenuContext);

/**
 * Registry mapping data attributes to specific context menu structures.
 * In a production app, this could be passed in as a prop or dynamically registered.
 */
const MENU_REGISTRY = {
  'video-item': [
    { label: 'Play Video', action: 'play', icon: '▶' },
    { label: 'Edit Metadata', action: 'edit', icon: '✎' },
    { label: 'Share Link', action: 'share', icon: '🔗' },
    { type: 'divider' },
    { label: 'Delete Video', action: 'delete', icon: '🗑', danger: true }
  ],
  'file-item': [
    { label: 'Open File', action: 'open', icon: '📄' },
    { label: 'Rename', action: 'rename', icon: '✎' },
    { label: 'Download', action: 'download', icon: '⬇' },
    { type: 'divider' },
    { label: 'Move to Trash', action: 'delete', icon: '🗑', danger: true }
  ]
};

/**
 * ContextMenuProvider
 * Intercepts right-clicks globally, prevents default browser behavior on designated 
 * elements, and renders a custom UI menu at safely calculated viewport coordinates.
 */
export const ContextMenuProvider = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [menuItems, setMenuItems] = useState([]);
  const [contextData, setContextData] = useState(null);

  const hideMenu = useCallback(() => {
    setIsVisible(false);
  }, []);

  useEffect(() => {
    const handleContextMenu = (e) => {
      // Traverse up the DOM tree to see if the clicked target (or its parents) 
      // has the designated data attribute.
      const target = e.target.closest('[data-context-menu]');
      
      if (!target) {
        // Not a designated element; hide our custom menu and let the browser's default menu show.
        hideMenu();
        return;
      }

      // Prevent the default browser context menu from appearing
      e.preventDefault(); 

      const contextType = target.getAttribute('data-context-menu');
      const payloadId = target.getAttribute('data-context-id');

      const items = MENU_REGISTRY[contextType];

      if (items && items.length > 0) {
        setMenuItems(items);
        setContextData({ type: contextType, id: payloadId });
        
        // Anti-clipping Math: Calculate safe X/Y coordinates
        const MENU_WIDTH = 220; 
        const ITEM_HEIGHT = 36;
        const DIVIDER_HEIGHT = 9;
        
        // Estimate height based on items and dividers
        const MENU_HEIGHT = items.reduce((acc, curr) => 
          acc + (curr.type === 'divider' ? DIVIDER_HEIGHT : ITEM_HEIGHT)
        , 0) + 16; // 16px for padding top/bottom

        let x = e.clientX;
        let y = e.clientY;

        // If the menu extends past the right edge, flip it to the left
        if (x + MENU_WIDTH > window.innerWidth) {
          x = window.innerWidth - MENU_WIDTH - 8;
        }
        
        // If the menu extends past the bottom edge, flip it upwards
        if (y + MENU_HEIGHT > window.innerHeight) {
          y = window.innerHeight - MENU_HEIGHT - 8;
        }

        setPosition({ x, y });
        setIsVisible(true);
      }
    };

    const handleClickOutside = () => {
      if (isVisible) hideMenu();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isVisible) hideMenu();
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, hideMenu]);

  // Handle clicking a menu item
  const handleAction = (item) => {
    console.log(`Context Action Dispatched: [${item.action}] for Entity ID: ${contextData?.id}`);
    
    // TODO: In a full app, dispatch to a global event bus or use a specialized context here
    // eventBus.emit(item.action, contextData);
    
    hideMenu();
  };

  return (
    <ContextMenuContext.Provider value={{ hideMenu }}>
      {children}
      
      {/* The floating Custom Menu */}
      {isVisible && (
        <div 
          style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            width: '220px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.05)',
            padding: '8px 0',
            zIndex: 999999, // Ensure it's above absolute everything (modals, toasts, etc)
            fontFamily: 'system-ui, sans-serif'
          }}
          // Stop clicks inside the menu from immediately triggering the window 'click' listener that hides the menu
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menuItems.map((item, idx) => {
            if (item.type === 'divider') {
              return <div key={`div-${idx}`} style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }}></div>;
            }

            return (
              <div 
                key={idx}
                onClick={() => handleAction(item)}
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: item.danger ? '#ef4444' : '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'background-color 0.1s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = item.danger ? '#fef2f2' : '#f1f5f9'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {item.icon && <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', opacity: item.danger ? 1 : 0.6 }}>{item.icon}</span>}
                {item.label}
              </div>
            );
          })}
        </div>
      )}
    </ContextMenuContext.Provider>
  );
};
