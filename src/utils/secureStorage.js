import CryptoJS from 'crypto-js';

const SECRET_KEY =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENCRYPTION_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENCRYPTION_KEY) ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_ENCRYPTION_KEY);

if (!SECRET_KEY) {
  throw new Error(
    'Encryption key is not configured. Set NEXT_PUBLIC_ENCRYPTION_KEY, VITE_ENCRYPTION_KEY, or REACT_APP_ENCRYPTION_KEY.'
  );
}

export const secureStorage = {
  /**
   * Encrypts the value and stores it in localStorage.
   * @param {string} key
   * @param {any} value
   */
  set: (key, value) => {
    if (!SECRET_KEY) {
      const configError = new Error('Encryption key is not configured');
      console.error(`Error encrypting and saving key "${key}" to localStorage:`, configError);
      throw configError;
    }
    try {
      const jsonValue = JSON.stringify(value);
      const encryptedValue = CryptoJS.AES.encrypt(jsonValue, SECRET_KEY).toString();
      localStorage.setItem(key, encryptedValue);
    } catch (error) {
      console.error(`Error encrypting and saving key "${key}" to localStorage:`, error);
      throw error;
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
    if (!SECRET_KEY) {
      console.warn(`secureStorage: encryption key is not configured; returning default for "${key}"`);
      return defaultValue;
    }
    try {
      const encryptedValue = localStorage.getItem(key);
      if (!encryptedValue) {
        return defaultValue;
      }

      const bytes = CryptoJS.AES.decrypt(encryptedValue, SECRET_KEY);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedString) {
        throw new Error('Decryption resulted in an empty string (possible Secret Key mismatch)');
      }

      return JSON.parse(decryptedString);
    } catch (error) {
      console.warn(`Error decrypting data for key "${key}". Purging corrupted data...`, error);
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
