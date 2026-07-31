import React from 'react';
// Note: In production, ensure framer-motion is installed: `npm install framer-motion`
// import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// Mocking framer-motion for demonstration purposes so the file builds 
// cleanly without node_modules errors in this sandbox environment.
const motion = {
  div: ({ children, style, ...props }) => <div style={style} {...props}>{children}</div>
};
const AnimatePresence = ({ children }) => <>{children}</>;
const useReducedMotion = () => false;

/**
 * PageTransitionWrapper
 * Orchestrates global exit and entry animations for page routing, giving
 * the application a premium, native feel.
 * 
 * @param {string} locationKey - The unique key for the current route (e.g., router.pathname)
 * @param {React.ReactNode} children - The page content to be animated
 */
export const PageTransitionWrapper = ({ locationKey, children }) => {
  // Accessibility First: Respect user's OS-level settings for motion
  const shouldReduceMotion = useReducedMotion();

  // Define the complex animation states for the Orchestrator
  const variants = {
    // 1. Starting state of a newly mounted page
    initial: {
      opacity: 0,
      y: 20, // Will slide up from 20px below
      scale: 1,
    },
    // 2. Active state (The slide-up & fade-in animation)
    enter: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1], // Custom iOS-style cubic-bezier for a premium snap feel
      },
    },
    // 3. Unmounting state (The scale-down & fade-out animation)
    exit: {
      opacity: 0,
      scale: 0.96, // Visually recede into the background
      transition: {
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  // If the user requires reduced motion, overwrite the physics to be instant/invisible
  const accessibleVariants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        enter: { opacity: 1, transition: { duration: 0.01 } },
        exit: { opacity: 0, transition: { duration: 0.01 } },
      }
    : variants;

  return (
    /* 
      AnimatePresence is critical: It hooks into the React component lifecycle to delay 
      the actual DOM node destruction until the 'exit' animation mathematically completes.
      mode="wait" ensures the exit completely finishes before the *new* page begins its 'enter'.
    */
    <AnimatePresence mode="wait">
      <motion.div
        key={locationKey}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={accessibleVariants}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransitionWrapper;
