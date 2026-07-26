import React, { useEffect, useRef, useState } from 'react';

/**
 * AudioStreamer
 * A foundational WebRTC component that accesses the local microphone, 
 * prepares a Peer-to-Peer connection, and visualizes the audio frequencies.
 */
const AudioStreamer = () => {
  const canvasRef = useRef(null);
  
  // Keep track of active media streams and connections to prevent memory leaks
  const streamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  
  const [error, setError] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = async () => {
    try {
      // 1. Request Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      setIsStreaming(true);
      setError(null);

      // 2. Setup WebRTC Peer Connection Placeholder
      // Using Google's public STUN server to resolve the local public IP
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // Add the local audio tracks to the RTC connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Generate an SDP Offer (Session Description Protocol)
      // Since we don't have a signaling server (e.g., Socket.io) yet, we simply log it.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('--- WebRTC SDP Offer Created ---');
      console.log(offer.sdp);
      console.log('--------------------------------');

      // 3. Setup Web Audio API for the visualizer
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');

      // Visualizer render loop
      const draw = () => {
        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;

        // Schedule the next frame
        animationFrameRef.current = requestAnimationFrame(draw);

        // Populate the data array with current frequency data
        analyzer.getByteFrequencyData(dataArray);

        // Paint background
        canvasCtx.fillStyle = '#0f172a'; // Slate-900
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i];

          // Dynamic gradient based on frequency intensity
          canvasCtx.fillStyle = `rgb(${barHeight + 100}, 99, 235)`; // Blue-ish tone
          canvasCtx.fillRect(x, HEIGHT - (barHeight / 2), barWidth, barHeight / 2);

          x += barWidth + 1; // Add 1px gap between bars
        }
      };

      // Start the loop
      draw();

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please ensure browser permissions are granted.');
    }
  };

  const stopStream = () => {
    // Stop Animation Loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Close Audio Context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }

    // EXPLICITLY Stop Media Tracks so the browser recording light turns off
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Close Peer Connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setIsStreaming(false);

    // Clear Canvas visualizer
    if (canvasRef.current) {
      const canvasCtx = canvasRef.current.getContext('2d');
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // Ensure absolutely everything cleans up if the component unmounts mid-stream
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '32px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '20px' }}>1-on-1 Audio Room</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Testing Local WebRTC Connection</p>
      </div>
      
      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#ef4444', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fecaca', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Visualizer Canvas Container */}
      <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', overflow: 'hidden', height: '160px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
        <canvas 
          ref={canvasRef} 
          width="500" 
          height="160" 
          style={{ width: '100%', height: '100%', display: isStreaming ? 'block' : 'none' }} 
        />
        {!isStreaming && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '32px' }}>🎙️</span>
            <span style={{ color: '#475569', fontSize: '14px', fontWeight: '500' }}>Microphone Inactive</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {!isStreaming ? (
          <button 
            onClick={startStream}
            style={{ padding: '12px 32px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background-color 0.2s', width: '100%' }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            Connect Audio
          </button>
        ) : (
          <button 
            onClick={stopStream}
            style={{ padding: '12px 32px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background-color 0.2s', width: '100%' }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
          >
            End Connection
          </button>
        )}
      </div>
      
      {isStreaming && (
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#94a3b8' }}>
          Check your browser developer console to view the raw <strong>WebRTC SDP Offer</strong>.
        </p>
      )}
    </div>
  );
};

export default AudioStreamer;
