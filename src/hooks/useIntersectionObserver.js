import { useState, useEffect } from 'react';

/**
 * Custom hook to detect when an element enters the viewport using the native Intersection Observer API.
 * 
 * @param {React.MutableRefObject} ref - The React ref attached to the DOM element to observe
 * @param {Object} options - IntersectionObserver configuration options (root, rootMargin, threshold)
 * @returns {boolean} - True if the element is currently intersecting with the viewport
 */
export const useIntersectionObserver = (ref, options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  // Destructure options to safely add them to the dependency array
  const { threshold = 0, root = null, rootMargin = '0px' } = options;

  useEffect(() => {
    const element = ref?.current;
    
    // If the element hasn't mounted yet, do nothing
    if (!element) return;

    // Initialize the observer
    const observer = new IntersectionObserver(([entry]) => {
      // Update state based on visibility
      setIsIntersecting(entry.isIntersecting);
    }, { threshold, root, rootMargin });

    // Start observing the target element
    observer.observe(element);

    // Cleanup function: Disconnect the observer when the component unmounts
    // to prevent memory leaks and zombie event listeners.
    return () => {
      observer.disconnect();
    };
  }, [ref, threshold, root, rootMargin]);

  return isIntersecting;
};
