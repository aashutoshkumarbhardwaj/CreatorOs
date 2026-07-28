import { useState, useRef, useCallback } from 'react';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_RETRIES = 3;

// Mock upload function to simulate chunk uploading over a network
const mockUploadChunk = async (chunk, index, total) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate random network failure (10% chance) to test retry logic
      if (Math.random() < 0.1) {
        reject(new Error('Network error'));
      } else {
        resolve();
      }
    }, 500); // 500ms artificial delay per chunk
  });
};

export const useChunkedUpload = (file) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, uploading, paused, error, success
  const [error, setError] = useState(null);

  const currentChunkIndexRef = useRef(0);
  const statusRef = useRef('idle'); // Sync tracking for loops

  const totalChunks = file ? Math.ceil(file.size / CHUNK_SIZE) : 0;

  const updateStatus = (newStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
  };

  const uploadChunkWithRetry = async (chunk, index, attempt = 1) => {
    try {
      await mockUploadChunk(chunk, index, totalChunks);
    } catch (err) {
      if (attempt <= MAX_RETRIES && statusRef.current === 'uploading') {
        const backoffTime = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s...
        console.warn(`Chunk ${index} failed. Retrying in ${backoffTime}ms (Attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise((res) => setTimeout(res, backoffTime));
        return uploadChunkWithRetry(chunk, index, attempt + 1);
      }
      throw err;
    }
  };

  const processQueue = useCallback(async () => {
    if (!file) return;

    while (currentChunkIndexRef.current < totalChunks && statusRef.current === 'uploading') {
      const index = currentChunkIndexRef.current;
      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      try {
        await uploadChunkWithRetry(chunk, index);
        
        // Break out if status changed (paused/cancelled) during the upload
        if (statusRef.current !== 'uploading') return;

        currentChunkIndexRef.current += 1;
        setProgress(Math.round((currentChunkIndexRef.current / totalChunks) * 100));
        
        if (currentChunkIndexRef.current === totalChunks) {
          updateStatus('success');
        }
      } catch (err) {
        updateStatus('error');
        setError(`Failed to upload chunk ${index + 1} after ${MAX_RETRIES} retries.`);
        return;
      }
    }
  }, [file, totalChunks]);

  const start = useCallback(() => {
    if (statusRef.current === 'uploading' || !file) return;
    updateStatus('uploading');
    setError(null);
    processQueue();
  }, [file, processQueue]);

  const pause = useCallback(() => {
    if (statusRef.current === 'uploading') {
      updateStatus('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current === 'paused') {
      updateStatus('uploading');
      processQueue();
    }
  }, [processQueue]);

  const cancel = useCallback(() => {
    updateStatus('idle');
    setProgress(0);
    currentChunkIndexRef.current = 0;
    setError(null);
  }, []);

  return {
    progress,
    status,
    error,
    start,
    pause,
    resume,
    cancel
  };
};
