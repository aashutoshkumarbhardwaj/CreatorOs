import { useState, useRef, useCallback, useEffect } from 'react';

export const useCsvWorker = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const workerRef = useRef(null);

  useEffect(() => {
    // Instantiate the worker when the hook mounts
    // Note: React/Vite/NextJS all support this standard Worker URL syntax
    workerRef.current = new Worker(new URL('../workers/csvExportWorker.js', import.meta.url));
    
    return () => {
      // Clean up the worker on unmount to prevent memory leaks
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const exportCsv = useCallback((data, filename = 'analytics_export.csv') => {
    if (!workerRef.current) return;
    
    setIsExporting(true);
    setError(null);

    const handleMessage = (e) => {
      const { blob, error: workerError } = e.data;
      
      if (workerError) {
        setError(workerError);
        setIsExporting(false);
        workerRef.current.removeEventListener('message', handleMessage);
        return;
      }

      if (blob) {
        // Trigger file download programmatically in the browser
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup DOM and object URL
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setIsExporting(false);
        workerRef.current.removeEventListener('message', handleMessage);
      }
    };

    workerRef.current.addEventListener('message', handleMessage);
    
    // Send data to the background thread
    workerRef.current.postMessage({ data });
  }, []);

  return { exportCsv, isExporting, error };
};
