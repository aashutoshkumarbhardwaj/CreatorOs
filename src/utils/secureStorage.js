import CryptoJS from 'crypto-js';

// Resolve the secret key from environment variables (supports Vite, Next.js, Create React App)
// Fallback to a hardcoded string to ensure it doesn't crash during local dev if env is missing
const SECRET_KEY = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENCRYPTION_KEY) || 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENCRYPTION_KEY) || 
  (typeof process !== 'undefined' && process.env?.REACT_APP_ENCRYPTION_KEY) ||
  'default-fallback-secure-key-12345!';

export const secureStorage = {
  /**
   * Encrypts the value and stores it in localStorage.
   * @param {string} key 
   * @param {any} value 
   */
  set: (key, value) => {
    try {
      const jsonValue = JSON.stringify(value);
      const encryptedValue = CryptoJS.AES.encrypt(jsonValue, SECRET_KEY).toString();
      localStorage.setItem(key, encryptedValue);
    } catch (error) {
      console.error(`Error encrypting and saving key "${key}" to localStorage:`, error);
    }
  },

  /**
   * Retrieves the value from localStorage and decrypts it.
   * If decryption fails (e.g. key mismatch), the corrupted entry is purged.
   * @param {string} key 
   * @param {any} defaultValue 
   * @returns {any}
   */
  get: (key, defaultValue = null) => {
    try {
      const encryptedValue = localStorage.getItem(key);
      if (!encryptedValue) {
        return defaultValue;
      }

      const bytes = CryptoJS.AES.decrypt(encryptedValue, SECRET_KEY);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      
      // If the secret key changed, decryption yields an empty string
      if (!decryptedString) {
        throw new Error('Decryption resulted in an empty string (possible Secret Key mismatch)');
      }

      return JSON.parse(decryptedString);
    } catch (error) {
      console.warn(`Error decrypting data for key "${key}". Purging corrupted data...`, error);
      // Fallback: clear the unreadable data and return the default value to prevent app crashes
      localStorage.removeItem(key);
      return defaultValue;
    }
  },
  
  /**
   * Removes a specific item from localStorage
   * @param {string} key 
   */
  remove: (key) => {
    localStorage.removeItem(key);
  },
  
  /**
   * Clears the entire localStorage
   */
  clear: () => {
    localStorage.clear();
  }
};
