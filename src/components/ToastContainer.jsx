import React, { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';

// Internal component to handle the lifecycle and animation of a single toast
const ToastItem = ({ toast, removeToast }) => {
  const [isClosing, setIsClosing] = useState(false);

  // Handle the automatic exit animation based on the duration
  useEffect(() => {
    if (toast.duration > 0) {
      // Trigger the slide-out animation 300ms before the actual unmount
      const animationTimer = setTimeout(() => {
        setIsClosing(true);
      }, toast.duration - 300);

      // Actually remove from DOM after the animation completes
      const removeTimer = setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);

      return () => {
        clearTimeout(animationTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [toast.duration, toast.id, removeToast]);

  const handleManualClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 300); // Wait for the slide-out animation to finish
  };

  const getTheme = () => {
    switch (toast.type) {
      case 'success': return { bg: '#10b981', icon: '✓' };
      case 'error': return { bg: '#ef4444', icon: '✕' };
      case 'warning': return { bg: '#f59e0b', icon: '⚠️' };
      case 'info':
      default: return { bg: '#3b82f6', icon: 'ℹ' };
    }
  };

  const theme = getTheme();

  return (
    <div
      style={{
        backgroundColor: theme.bg,
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: '280px',
        maxWidth: '380px',
        pointerEvents: 'auto',
        // Toggle the animation based on state
        animation: isClosing ? 'toast-slide-out 0.3s ease forwards' : 'toast-slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        transformOrigin: 'top right'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{theme.icon}</span>
        <span style={{ fontSize: '14px', lineHeight: '1.4', fontWeight: '500' }}>{toast.message}</span>
      </div>
      <button 
        onClick={handleManualClose}
        aria-label="Close notification"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.8)',
          cursor: 'pointer',
          padding: '4px',
          marginLeft: '12px',
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          transition: 'color 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
        onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
      >
        ×
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999, // Ensure it always sits on top of modals/overlays
        pointerEvents: 'none', // Let clicks pass through the invisible container
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {/* Inject Keyframe animations for the toasts */}
      <style>
        {`
          @keyframes toast-slide-in {
            from {
              transform: translateX(120%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes toast-slide-out {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(120%);
              opacity: 0;
            }
          }
        `}
      </style>
      
      {/* Map over the active toasts in state */}
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};
