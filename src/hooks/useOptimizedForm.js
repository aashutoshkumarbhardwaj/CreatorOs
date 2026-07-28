import { useRef, useCallback, useState, useEffect } from 'react';

/**
 * FormEventEmitter (Pub/Sub)
 * A lightweight event bus to notify specific fields about their own validation errors
 * without triggering a global re-render of the parent form component.
 */
class FormEventEmitter {
  constructor() {
    this.listeners = {};
  }
  
  subscribe(field, callback) {
    if (!this.listeners[field]) {
      this.listeners[field] = [];
    }
    this.listeners[field].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[field] = this.listeners[field].filter(cb => cb !== callback);
    };
  }
  
  emit(field, errorMsg) {
    if (this.listeners[field]) {
      this.listeners[field].forEach(cb => cb(errorMsg));
    }
  }
}

/**
 * useOptimizedForm
 * A high-performance form hook that completely decouples input state from the 
 * React render cycle using `useRef` and localized Pub/Sub updates.
 * 
 * @param {Object} options - { defaultValues: {} }
 */
export const useOptimizedForm = ({ defaultValues = {} } = {}) => {
  // Store all form values in a ref. This prevents re-renders on keystrokes.
  const valuesRef = useRef({ ...defaultValues });
  
  // Store validation rules per registered field
  const rulesRef = useRef({});
  
  // Keep track of errors internally so handleSubmit can access them
  const errorsRef = useRef({});
  
  // Initialize the Pub/Sub instance to broadcast localized error rendering
  const emitterRef = useRef(new FormEventEmitter());

  // Internal validation engine
  const validateField = (name, value, rules) => {
    if (!rules) return null;
    
    if (rules.required) {
      const isMissing = value === undefined || value === null || value === '' || (typeof value === 'boolean' && !value);
      if (isMissing) {
        return typeof rules.required === 'string' ? rules.required : 'This field is required';
      }
    }
    
    if (rules.pattern && value) {
      const regex = new RegExp(rules.pattern.value);
      if (!regex.test(value)) {
        return rules.pattern.message || 'Invalid format';
      }
    }
    
    if (rules.validate && typeof rules.validate === 'function') {
      const result = rules.validate(value, valuesRef.current);
      if (typeof result === 'string') return result; // custom error message
      if (result === false) return 'Validation failed';
    }
    
    return null;
  };

  /**
   * Registers an input element into the optimized form system.
   * 
   * @param {string} name - The unique field name
   * @param {Object} rules - Validation rules { required, pattern: { value, message }, validate }
   * @returns {Object} - DOM event bindings to spread onto the input: {...register('email')}
   */
  const register = useCallback((name, rules = {}) => {
    rulesRef.current[name] = rules;
    
    if (valuesRef.current[name] === undefined) {
      valuesRef.current[name] = '';
    }

    const onChange = (e) => {
      const target = e.target;
      const value = target.type === 'checkbox' ? target.checked : target.value;
      
      // Update state without triggering a React render
      valuesRef.current[name] = value;
      
      // If the field currently has an error, clear it instantly on typing
      if (errorsRef.current[name]) {
        errorsRef.current[name] = null;
        emitterRef.current.emit(name, null);
      }
    };

    const onBlur = () => {
      const value = valuesRef.current[name];
      const error = validateField(name, value, rulesRef.current[name]);
      
      // Only emit if the error state changed to avoid unnecessary renders
      if (errorsRef.current[name] !== error) {
        errorsRef.current[name] = error;
        emitterRef.current.emit(name, error);
      }
    };

    return {
      name,
      defaultValue: valuesRef.current[name],
      onChange,
      onBlur,
    };
  }, []);

  /**
   * Wraps the user's submit callback, runs full validation first, 
   * and prevents default form submission.
   * 
   * @param {Function} onSubmit - User callback receiving (data)
   */
  const handleSubmit = useCallback((onSubmit) => (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    
    let isValid = true;
    const values = valuesRef.current;
    
    // Run validation on all registered fields simultaneously
    Object.keys(rulesRef.current).forEach(name => {
      const value = values[name];
      const error = validateField(name, value, rulesRef.current[name]);
      
      if (errorsRef.current[name] !== error) {
        errorsRef.current[name] = error;
        emitterRef.current.emit(name, error); // broadcast to localized inputs
      }
      
      if (error) {
        isValid = false;
      }
    });

    if (isValid) {
      onSubmit({ ...values });
    }
  }, []);

  return {
    register,
    handleSubmit,
    emitter: emitterRef.current,
    getValues: () => ({ ...valuesRef.current })
  };
};

/**
 * A companion utility hook to be used specifically inside custom Input wrapper components.
 * It subscribes to the FormEventEmitter so only *this specific input* re-renders 
 * when its own validation fails, rather than the entire form.
 * 
 * @param {string} name - The field name to listen for
 * @param {Object} emitter - The emitter instance returned from useOptimizedForm
 * @returns {string|null} - The localized error message
 */
export const useFieldError = (name, emitter) => {
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!emitter) return;
    
    // Subscribe to localized error updates
    const unsubscribe = emitter.subscribe(name, (errMsg) => {
      setError(errMsg);
    });
    
    return unsubscribe;
  }, [name, emitter]);

  return error;
};
