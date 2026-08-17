import { useState, useCallback } from 'react';
import { secureStorage } from '../utils/secureStorage';

/**
 * A custom hook that works exactly like React.useState, but persists the state
 * securely in localStorage using AES encryption.
 * 
 * @param {string} key - The localStorage key 
 * @param {any} initialValue - The default value to fall back to
 * @returns {[any, Function, Function]} - [storedValue, setValue, removeValue]
 */
export const useSecureStorage = (key, initialValue) => {
  // Pass an initializer function to useState so the get logic executes only once
  const [storedValue, setStoredValue] = useState(() => {
    // Check for SSR (Server Side Rendering) environments
    if (typeof window === 'undefined') {
      return initialValue;
    }
    return secureStorage.get(key, initialValue);
  });

  // Wrapped setter function that persists the new value to secureStorage
  const setValue = useCallback((value) => {
    try {
      // Support functional updates just like standard useState: setValue(prev => prev + 1)
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        secureStorage.set(key, valueToStore);
      }
    } catch (error) {
      console.error(`Error securely setting state for key "${key}"`, error);
    }
  }, [key, storedValue]);
  
  // Expose a function to easily wipe the key from both local state and storage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue); // Revert to initial
      if (typeof window !== 'undefined') {
        secureStorage.remove(key);
      }
    } catch (error) {
      console.error(`Error securely removing state for key "${key}"`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};
