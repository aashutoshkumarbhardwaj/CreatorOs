import React, { useState } from 'react';

/**
 * Mock API simulating the WebAuthn / Passkey authentication flow
 */
const triggerWebAuthn = async (email) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // In a real app, this would call navigator.credentials.get() or navigator.credentials.create()
      // We simulate a successful biometric verification after 2 seconds
      if (email.includes('@')) {
        resolve({ success: true, user: email });
      } else {
        reject(new Error('Invalid email format'));
      }
    }, 2000);
  });
};

/**
 * Passwordless WebAuthn Login System
 * Allows creators to securely log in using biometric passkeys (TouchID, FaceID)
 * instead of vulnerable passwords.
 */
export const WebAuthnLogin = () => {
  const [step, setStep] = useState('login'); // login | authenticating | success
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handlePasskeyLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setStep('authenticating');

    try {
      await triggerWebAuthn(email);
      setStep('success');
    } catch (err) {
      setError('Authentication failed. Please try again.');
      setStep('login');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ backgroundColor: '#ffffff', padding: '40px 32px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        
        {/* Header / Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#0f172a', borderRadius: '12px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            🦋
          </div>
          <h2 style={{ fontSize: '24px', margin: '0 0 8px 0' }}>Welcome to Title</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Sign in to manage your creator identity.
          </p>
        </div>

        {/* Step 1: Login Form */}
        {step === 'login' && (
          <form onSubmit={handlePasskeyLogin}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>
                Email Address
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@example.com"
                required
                style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '15px', outlineColor: '#3b82f6' }}
              />
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button 
              type="submit"
              style={{ 
                width: '100%', padding: '16px', backgroundColor: '#0f172a', color: '#fff', 
                border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', 
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <span style={{ fontSize: '18px' }}>🔐</span>
              Sign in with Passkey
            </button>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                No passwords required. Use TouchID, FaceID, or your security key to securely authenticate.
              </p>
            </div>
          </form>
        )}

        {/* Step 2: Simulated Browser Authentication Prompt */}
        {step === 'authenticating' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: '80px', height: '80px', margin: '0 auto 24px', position: 'relative' }}>
              {/* Outer pulsing ring */}
              <div style={{ position: 'absolute', inset: 0, border: '4px solid #3b82f6', borderRadius: '50%', opacity: 0.2, animation: 'pulse 1.5s ease-out infinite' }}>
                <style>{`@keyframes pulse { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.4); opacity: 0; } }`}</style>
              </div>
              {/* Inner Fingerprint Icon */}
              <div style={{ position: 'absolute', inset: '10px', backgroundColor: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                👆
              </div>
            </div>
            
            <h3 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>Verify your identity</h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Follow the instructions on your device to sign in.
            </p>
          </div>
        )}

        {/* Step 3: Success State */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#fff', fontSize: '32px', boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.3)' }}>
              ✓
            </div>
            <h3 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#0f172a' }}>Authenticated!</h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Welcome back, {email}. Redirecting to your dashboard...
            </p>
          </div>
        )}

      </div>
      
    </div>
  );
};

export default WebAuthnLogin;
