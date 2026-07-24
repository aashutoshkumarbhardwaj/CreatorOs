import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Create the Context
const ToastContext = createContext(null);

/**
 * Custom hook to consume the Toast Context.
 * Must be used within a ToastProvider.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Provider component that wraps the app and manages the global toast state.
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);

  // Removes a toast by its unique ID
  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Adds a new toast to the global state.
   * @param {Object} options 
   * @param {string} options.message - The text to display
   * @param {'success'|'error'|'warning'|'info'} [options.type='info'] - The semantic type
   * @param {number} [options.duration=5000] - Time in ms before auto-unmounting
   */
  const addToast = useCallback(({ message, type = 'info', duration = 5000 }) => {
    const id = (idCounter.current += 1);
    
    const newToast = {
      id,
      message,
      type,
      duration,
    };
    
    setToasts((prev) => [...prev, newToast]);

    // Setup auto-removal if duration is greater than 0
    if (duration > 0) {
      setTimeout(() => {
        // We let the ToastItem handle its own exit animation, but the provider acts as a fallback
        // if we just want a strict removal.
      }, duration);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
      {children}
    </ToastContext.Provider>
  );
};
