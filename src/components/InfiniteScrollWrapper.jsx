import React, { useRef, useEffect } from 'react';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

/**
 * A wrapper component that implements infinite scrolling for a list of children.
 * 
 * @param {React.ReactNode} children - The list items to render above the scroll sentinel
 * @param {Function} fetchNextPage - Callback to execute when the bottom of the list is reached
 * @param {boolean} hasNextPage - Determines if the observer should continue watching
 * @param {boolean} isFetchingNextPage - Prevents duplicate fetch calls while a request is pending
 */
const InfiniteScrollWrapper = ({ 
  children, 
  fetchNextPage, 
  hasNextPage, 
  isFetchingNextPage 
}) => {
  // Create a ref for the "Sentinel" DOM node placed at the bottom of the list
  const loadMoreRef = useRef(null);
  
  // Use the custom hook to monitor the sentinel's visibility
  const isVisible = useIntersectionObserver(loadMoreRef, {
    // rootMargin '100px' triggers the intersection slightly before the user 
    // actually hits the bottom, providing a seamless scrolling experience.
    rootMargin: '100px', 
    threshold: 0
  });

  // Effect to trigger the fetch callback when the sentinel becomes visible
  useEffect(() => {
    if (isVisible && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isVisible, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      {/* Render the main content (the long list) */}
      {children}
      
      {/* 
        The Sentinel Element:
        This sits at the bottom of the list. When it scrolls into view, 
        the Intersection Observer fires.
      */}
      <div 
        ref={loadMoreRef} 
        style={{ 
          height: '60px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          marginTop: '16px',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        {isFetchingNextPage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Simple CSS Spinner */}
            <span style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              border: '2px solid #cbd5e1',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}>
              <style>
                {`@keyframes spin { to { transform: rotate(360deg); } }`}
              </style>
            </span>
            <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
              Loading more content...
            </span>
          </div>
        )}
        
        {/* Render a friendly message when we hit the absolute end of the database */}
        {!hasNextPage && (
          <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>
            You've reached the end! 🎉
          </span>
        )}
      </div>
    </>
  );
};

export default InfiniteScrollWrapper;
