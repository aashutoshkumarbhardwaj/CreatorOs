import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Initialize the Context
const WizardContext = createContext(null);

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};

/**
 * WizardProvider
 * Manages complex nested state across multiple screens, including LocalStorage persistence
 * and strict step-by-step validation logic.
 * 
 * @param {string} wizardId - Unique identifier to namespace localStorage keys
 * @param {Object} initialData - Default structure of the form data
 * @param {Array} steps - Array of objects defining { label, component, validate (async fn) }
 */
export const WizardProvider = ({ 
  children, 
  wizardId = 'default_wizard', 
  initialData = {}, 
  steps = [] 
}) => {
  const STORAGE_KEY = `creator_os_wizard_${wizardId}`;

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(initialData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // To handle async validation states

  // 1. Hydrate state from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { step, data } = JSON.parse(saved);
        setCurrentStep(step || 0);
        setFormData(data || initialData);
      }
    } catch (e) {
      console.error('Failed to load wizard state from storage', e);
    }
    setIsLoaded(true);
  }, [STORAGE_KEY, initialData]);

  // 2. Persist state to LocalStorage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        step: currentStep,
        data: formData
      }));
    }
  }, [currentStep, formData, isLoaded, STORAGE_KEY]);

  const updateFormData = useCallback((newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
  }, []);

  // Strict step validation logic
  const validateStep = async (stepIndex) => {
    const step = steps[stepIndex];
    if (step && typeof step.validate === 'function') {
      try {
        return await step.validate(formData);
      } catch (error) {
        console.error(`Validation error at step ${stepIndex}:`, error);
        return false;
      }
    }
    return true; // Assume valid if no validation function is explicitly provided
  };

  const nextStep = useCallback(async () => {
    setIsNavigating(true);
    const isValid = await validateStep(currentStep);
    
    if (isValid && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else if (!isValid) {
      console.warn(`Validation failed for step ${currentStep}. Cannot proceed.`);
    }
    
    setIsNavigating(false);
    return isValid;
  }, [currentStep, steps, formData]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(async (index) => {
    if (index === currentStep) return true;
    
    setIsNavigating(true);
    
    // If jumping forward, we must strictly validate all intermediate steps
    if (index > currentStep) {
      for (let i = currentStep; i < index; i++) {
         const isValid = await validateStep(i);
         if (!isValid) {
           console.warn(`Cannot jump to step ${index}. Validation failed at intermediate step ${i}.`);
           setIsNavigating(false);
           return false;
         }
      }
    }
    
    setCurrentStep(index);
    setIsNavigating(false);
    return true;
  }, [currentStep, steps, formData]);

  const clearWizard = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentStep(0);
    setFormData(initialData);
  }, [STORAGE_KEY, initialData]);

  // Wait for initial hydration to prevent hydration mismatch flashes
  if (!isLoaded) return null; 

  return (
    <WizardContext.Provider value={{
      currentStep,
      formData,
      updateFormData,
      nextStep,
      prevStep,
      goToStep,
      clearWizard,
      steps,
      isNavigating,
      isFirstStep: currentStep === 0,
      isLastStep: currentStep === steps.length - 1
    }}>
      {children}
    </WizardContext.Provider>
  );
};
