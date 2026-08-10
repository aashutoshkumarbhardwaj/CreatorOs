import React, { useState } from 'react';

/**
 * DynamicFormBuilder
 * Generates a form dynamically based on a provided JSON schema.
 * 
 * @param {Array} schema - Array of field definition objects
 * @param {Function} onSubmit - Callback fired with validated form data
 */
const DynamicFormBuilder = ({ schema = [], onSubmit }) => {
  // 1. Initialize centralized state based on the schema defaults
  const initialState = schema.reduce((acc, field) => {
    if (field.type === 'checkbox') {
      acc[field.name] = field.defaultValue || false;
    } else {
      acc[field.name] = field.defaultValue || '';
    }
    return acc;
  }, {});

  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});

  // 2. Validation Logic
  const validateField = (name, value, fieldSchema) => {
    // Required check
    if (fieldSchema.required) {
      if (fieldSchema.type === 'checkbox' && value !) {
         return `${fieldSchema.label} is required`;
      }
      if (value === '' || value === null || value === undefined) {
        return `${fieldSchema.label} is required`;
      }
    }
    
    // Regex Pattern check
    if (fieldSchema.pattern && value) {
      const regex = new RegExp(fieldSchema.pattern);
      if (!regex.test(value)) {
        return fieldSchema.errorMsg || `Invalid format for ${fieldSchema.label}`;
      }
    }
    
    return null;
  };

  const handleChange = (e, fieldSchema) => {
    const { name, value, type, checked } = e.target;
    
    // Handle checkbox booleans vs standard text values
    const val = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: val
    }));
    
    // If the field currently has an error, re-validate on change to clear it instantly
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: validateField(name, val, fieldSchema)
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    let newErrors = {};
    let isValid = true;
    
    // Validate all fields before submitting
    schema.forEach(field => {
      const err = validateField(field.name, formData[field.name], field);
      if (err) {
        newErrors[field.name] = err;
        isValid = false;
      }
    });
    
    if (isValid) {
      setErrors({}); // clear errors
      if (onSubmit) onSubmit(formData);
    } else {
      setErrors(newErrors); // Display inline errors
    }
  };

  // 3. Dynamic Renderer
  const renderField = (field) => {
    const { type, name, label, options = [] } = field;
    const value = formData[name];
    const error = errors[name];

    const inputStyle = {
      width: '100%',
      padding: '10px 14px',
      border: `1px solid ${error ? '#ef4444' : '#cbd5e1'}`,
      borderRadius: '6px',
      marginTop: '6px',
      outlineColor: error ? '#ef4444' : '#3b82f6',
      fontSize: '14px',
      color: '#334155',
      backgroundColor: '#ffffff'
    };

    switch (type) {
      case 'textarea':
        return (
          <textarea
            id={name}
            name={name}
            value={value}
            onChange={(e) => handleChange(e, field)}
            style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
            aria-invalid={!!error}
          />
        );
      case 'select':
        return (
          <select
            id={name}
            name={name}
            value={value}
            onChange={(e) => handleChange(e, field)}
            style={inputStyle}
            aria-invalid={!!error}
          >
            <option value="" disabled>Select {label}</option>
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      case 'radio':
        return (
          <div style={{ marginTop: '8px', display: 'flex', gap: '16px' }}>
            {options.map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => handleChange(e, field)}
                  style={{ marginRight: '6px', cursor: 'pointer', accentColor: '#3b82f6' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              id={name}
              name={name}
              checked={value}
              onChange={(e) => handleChange(e, field)}
              style={{ marginRight: '10px', width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
            />
            <label htmlFor={name} style={{ fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
              {label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
          </div>
        );
      case 'text':
      case 'password':
      case 'email':
      default:
        return (
          <input
            type={type}
            id={name}
            name={name}
            value={value}
            onChange={(e) => handleChange(e, field)}
            style={inputStyle}
            aria-invalid={!!error}
          />
        );
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      style={{ 
        maxWidth: '550px', 
        padding: '32px', 
        background: '#f8fafc', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      {schema.map(field => (
        <div key={field.name} style={{ marginBottom: '20px' }}>
          
          {/* Checkboxes render their own labels internally for layout reasons */}
          {field.type !== 'checkbox' && (
            <label htmlFor={field.name} style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
              {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
          )}
          
          {renderField(field)}
          
          {/* Inline Error Message */}
          {errors[field.name] && (
            <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px', fontWeight: '500' }}>
              {errors[field.name]}
            </div>
          )}
        </div>
      ))}
      
      <button 
        type="submit"
        style={{
          padding: '12px 24px',
          background: '#3b82f6',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '15px',
          width: '100%',
          marginTop: '12px',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
      >
        Submit Configuration
      </button>
    </form>
  );
};

export default DynamicFormBuilder;
