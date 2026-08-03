import React, { useState } from 'react';

/**
 * Creator Asset Monetization Gateway
 * Allows creators to upload digital assets (PDFs, presets) and gate them behind 
 * a mock Stripe paywall without needing to set up a full e-commerce store.
 */
export const AssetMonetizationGateway = () => {
  const [step, setStep] = useState('upload'); // upload | configure | live | checkout | success
  
  // Asset state
  const [assetName, setAssetName] = useState('');
  const [assetPrice, setAssetPrice] = useState('5.00');
  
  // Checkout state
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (e) => {
    e.preventDefault();
    setAssetName('Lightroom_Presets_Vol1.zip');
    setStep('configure');
  };

  const handlePublish = (e) => {
    e.preventDefault();
    if (!assetName || !assetPrice) return;
    setStep('live');
  };

  const handlePaywallClick = () => {
    setStep('checkout');
  };

  const handleSimulatePayment = (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep('success');
    }, 2000);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', margin: '0 0 12px 0' }}>Asset Monetization Gateway</h2>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '650px', margin: '0 auto' }}>
          Instantly monetize your digital files. Upload your PDFs or presets, set a price, and we'll automatically generate a high-converting Stripe paywall directly on your bio.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
        
        {/* Left Side: Creator Controls */}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '20px', margin: '0 0 24px 0' }}>Creator Dashboard</h3>
          
          {step === 'upload' && (
            <div 
              style={{ border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '64px 32px', textAlign: 'center', backgroundColor: '#f8fafc', cursor: 'pointer' }}
              onClick={handleFileUpload}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💸</div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>Upload Digital Asset</h4>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>Upload presets, wallpapers, or PDFs (Max 100MB)</p>
              
              <button style={{ padding: '12px 24px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                Select File to Monetize
              </button>
            </div>
          )}

          {(step === 'configure' || step === 'live' || step === 'checkout' || step === 'success') && (
            <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <div style={{ fontSize: '32px' }}>📦</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{assetName}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Ready for configuration</p>
                </div>
              </div>

              <form onSubmit={handlePublish}>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>
                    Asset Price (USD)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '16px', top: '14px', color: '#64748b', fontWeight: 'bold' }}>$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={assetPrice}
                      onChange={(e) => setAssetPrice(e.target.value)}
                      disabled={step !== 'configure'}
                      style={{ width: '100%', padding: '14px 14px 14px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '15px' }}
                    />
                  </div>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 4px 0', color: '#166534', fontSize: '14px' }}>Stripe Connect Enabled</h4>
                  <p style={{ margin: 0, color: '#15803d', fontSize: '13px' }}>Funds will be routed directly to your connected bank account.</p>
                </div>

                {step === 'configure' ? (
                  <button 
                    type="submit"
                    style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)' }}
                  >
                    Generate Paywall Link 🔗
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <code style={{ flex: 1, fontSize: '14px', fontWeight: 'bold', color: '#2563eb' }}>https://tit.le/pay/preset-v1</code>
                    <button type="button" style={{ padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      Copy
                    </button>
                  </div>
                )}
              </form>

            </div>
          )}

        </div>

        {/* Right Side: Buyer's View (Mock Mobile Bio) */}
        <div style={{ 
          width: '340px', backgroundColor: '#f8fafc', borderRadius: '40px', border: '8px solid #cbd5e1', 
          padding: '24px', boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          position: 'relative', overflow: 'hidden'
        }}>
          {/* Fake Notch */}
          <div style={{ width: '100px', height: '24px', backgroundColor: '#cbd5e1', borderRadius: '0 0 16px 16px', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} />

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#6366f1', margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>@CreatorName</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b' }}>Photographer & Editor</p>
          </div>

          {(step === 'upload' || step === 'configure') && (
            <div style={{ width: '100%', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0', borderRadius: '12px', color: '#94a3b8', fontSize: '14px' }}>
              Publish asset to view
            </div>
          )}

          {step === 'live' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button style={{ padding: '16px', borderRadius: '8px', border: 'none', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>My YouTube Gear</button>
              
              {/* Premium Link */}
              <button 
                onClick={handlePaywallClick}
                style={{ padding: '16px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
              >
                <span>{assetName}</span>
                <span style={{ backgroundColor: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>${assetPrice}</span>
              </button>
            </div>
          )}

          {step === 'checkout' && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#ffffff', padding: '40px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{assetName}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>By @CreatorName</p>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>${assetPrice}</div>
              </div>

              <form onSubmit={handleSimulatePayment} style={{ flex: 1 }}>
                <div style={{ marginBottom: '16px' }}>
                  <input type="email" placeholder="Email for receipt" required style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <input type="text" placeholder="Card number" required style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessing ? 'wait' : 'pointer' }}
                >
                  {isProcessing ? 'Processing...' : `Pay $${assetPrice}`}
                </button>
                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  🔒 Secured by Stripe
                </div>
              </form>
            </div>
          )}

          {step === 'success' && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#ffffff', padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '32px', marginBottom: '24px' }}>
                ✓
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Payment Successful!</h3>
              <p style={{ margin: '0 0 32px 0', fontSize: '14px', color: '#64748b' }}>Your receipt has been sent. You can now download your file.</p>
              
              <button style={{ width: '100%', padding: '16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '18px' }}>⬇️</span> Download Asset
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default AssetMonetizationGateway;
