import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (url) => {
  const [isConnected, setIsConnected] = useState(false);
  const [latestMessage, setLatestMessage] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isComponentUnmounted = useRef(false);

  const connect = useCallback(() => {
    if (isComponentUnmounted.current || !url) return;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        // Reset attempts on successful connection
        reconnectAttemptsRef.current = 0; 
      };

      wsRef.current.onmessage = (event) => {
        setLatestMessage(event.data);
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        if (!isComponentUnmounted.current) {
          scheduleReconnect();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error observed:', error);
        // The onclose event will automatically fire after onerror closes the socket
      };
    } catch (err) {
      console.error('WebSocket connection initialization error:', err);
      scheduleReconnect();
    }
  }, [url]);

  const scheduleReconnect = () => {
    if (isComponentUnmounted.current) return;

    // Exponential backoff algorithm: 1s, 2s, 4s, 8s, 16s...
    let backoffTime = Math.pow(2, reconnectAttemptsRef.current) * 1000;
    
    // Cap the maximum wait time to 30 seconds
    if (backoffTime > 30000) {
      backoffTime = 30000;
    }

    console.warn(`WebSocket dropped. Attempting to reconnect in ${backoffTime / 1000} seconds...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      connect();
    }, backoffTime);
  };

  useEffect(() => {
    isComponentUnmounted.current = false;
    connect();

    return () => {
      isComponentUnmounted.current = true;
      
      // Clear any pending reconnection timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Clean up the WebSocket instance strictly
      if (wsRef.current) {
        // Nullify event listeners to prevent memory leaks and zombie reconnect attempts
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Auto-stringify JSON objects for convenience
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      wsRef.current.send(payload);
    } else {
      console.warn('Cannot send message: WebSocket is not open.');
    }
  }, []);

  return {
    isConnected,
    latestMessage,
    sendMessage,
  };
};
