import React from 'react';
import { useWizard } from '../../contexts/WizardContext';

/**
 * Wizard UI Wrapper
 * 
 * Consumes the WizardContext to render the visual stepper, the current active 
 * step component, and the Next/Back navigation controls.
 * 
 * @param {Function} onComplete - Callback fired when the final step is submitted. Receives full formData.
 */
export const Wizard = ({ onComplete }) => {
  const { 
    currentStep, 
    steps, 
    nextStep, 
    prevStep, 
    isFirstStep, 
    isLastStep,
    formData,
    updateFormData,
    isNavigating,
    clearWizard
  } = useWizard();

  // Safely extract the component designated for the current step
  const StepComponent = steps[currentStep]?.component;

  if (!StepComponent) {
    return (
      <div style={{ padding: '20px', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', background: '#fef2f2' }}>
        <strong>Configuration Error:</strong> Invalid Wizard Step at index {currentStep}.
      </div>
    );
  }

  const handleFinalSubmit = async () => {
    // We still validate the final step before triggering onComplete
    const isValid = await nextStep(); 
    if (isValid && typeof onComplete === 'function') {
      onComplete(formData, clearWizard);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px', fontFamily: 'system-ui, sans-serif', background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      
      {/* 1. Progress Bar / Stepper Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', position: 'relative' }}>
        
        {/* Background track line */}
        <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '3px', background: '#e2e8f0', zIndex: 1, transform: 'translateY(-50%)' }}></div>
        
        {/* Progress track line */}
        <div style={{ position: 'absolute', top: '50%', left: '0', width: `${(currentStep / (steps.length - 1)) * 100}%`, height: '3px', background: '#3b82f6', zIndex: 2, transform: 'translateY(-50%)', transition: 'width 0.3s ease' }}></div>

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          
          return (
            <div key={index} style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: isActive || isCompleted ? '#3b82f6' : '#ffffff',
                border: isActive || isCompleted ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                color: isActive || isCompleted ? '#ffffff' : '#94a3b8',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}>
                {isCompleted ? '✓' : (index + 1)}
              </div>
              <span style={{ 
                marginTop: '8px', 
                fontSize: '12px', 
                fontWeight: isActive ? '600' : '500', 
                color: isActive ? '#1e293b' : '#64748b',
                whiteSpace: 'nowrap',
                position: 'absolute',
                top: '100%'
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* spacer for the absolute positioned labels */}
      <div style={{ height: '24px' }}></div>

      {/* 2. Render Current Step Component */}
      <div style={{ minHeight: '350px', padding: '24px 0' }}>
         <StepComponent formData={formData} updateFormData={updateFormData} />
      </div>

      {/* 3. Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
        <button 
          onClick={prevStep} 
          disabled={isFirstStep || isNavigating}
          style={{
            padding: '12px 24px',
            background: isFirstStep ? '#f8fafc' : '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            cursor: isFirstStep ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '15px',
            color: isFirstStep ? '#cbd5e1' : '#475569',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => { if (!isFirstStep) e.target.style.backgroundColor = '#f1f5f9' }}
          onMouseOut={(e) => { if (!isFirstStep) e.target.style.backgroundColor = '#ffffff' }}
        >
          Back
        </button>
        
        {!isLastStep ? (
          <button 
            onClick={nextStep}
            disabled={isNavigating}
            style={{
              padding: '12px 32px',
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: isNavigating ? 'wait' : 'pointer',
              fontWeight: '600',
              fontSize: '15px',
              opacity: isNavigating ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => { if(!isNavigating) e.target.style.backgroundColor = '#2563eb' }}
            onMouseOut={(e) => { if(!isNavigating) e.target.style.backgroundColor = '#3b82f6' }}
          >
            {isNavigating ? 'Validating...' : 'Next Step'}
          </button>
        ) : (
          <button 
            onClick={handleFinalSubmit}
            disabled={isNavigating}
            style={{
              padding: '12px 32px',
              background: '#10b981', // green for completion
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: isNavigating ? 'wait' : 'pointer',
              fontWeight: 'bold',
              fontSize: '15px',
              opacity: isNavigating ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => { if(!isNavigating) e.target.style.backgroundColor = '#059669' }}
            onMouseOut={(e) => { if(!isNavigating) e.target.style.backgroundColor = '#10b981' }}
          >
            {isNavigating ? 'Processing...' : 'Complete Workflow'}
          </button>
        )}
      </div>
    </div>
  );
};

export default Wizard;
