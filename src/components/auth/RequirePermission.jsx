import React, { useMemo } from 'react';

// NOTE: In the real application, import `useAuth` from your actual Authentication Context.
// import { useAuth } from '../../contexts/AuthContext';

// Mock hook implementation for demonstration purposes so the component functions independently.
const useAuth = () => {
  return {
    user: {
      role: 'editor', // e.g., 'admin', 'manager', 'editor'
      permissions: ['create_post', 'edit_post', 'view_analytics'] 
    }
  };
};

/**
 * RequirePermission
 * A declarative Role-Based Access Control (RBAC) wrapper component.
 * 
 * @param {string|Array<string>} requiredRole - Role(s) required to view the content (e.g., 'admin' or ['admin', 'manager'])
 * @param {Array<string>} allowedActions - Specific granular permissions required (e.g., ['delete_post', 'publish_post'])
 * @param {React.ReactNode} fallback - Component to render if access is denied (defaults to null/hidden)
 * @param {React.ReactNode} children - Content to render if access is granted
 */
const RequirePermission = ({ 
  requiredRole, 
  allowedActions = [], 
  fallback = null, 
  children 
}) => {
  const { user } = useAuth();

  // Heavily memoize the permission evaluation to prevent UI stutter during React renders
  const hasAccess = useMemo(() => {
    if (!user) return false;

    const userRole = user.role?.toLowerCase();

    // 1. Role-based check
    if (requiredRole) {
      const targetRoles = Array.isArray(requiredRole) 
        ? requiredRole.map(r => r.toLowerCase()) 
        : [requiredRole.toLowerCase()];
      
      if (!targetRoles.includes(userRole)) {
        // Supreme admin override fallback
        if (userRole !== 'admin') {
           return false;
        }
      }
    }

    // 2. Action/Permission-based check
    if (allowedActions && allowedActions.length > 0) {
      const userPermissions = user.permissions || [];
      
      // Ensure the user has EVERY requested action in their permission array
      const hasAllActions = allowedActions.every(action => userPermissions.includes(action));
      
      if (!hasAllActions && userRole !== 'admin') {
        return false;
      }
    }

    return true;
  }, [user, requiredRole, allowedActions]);

  // If the user fails the evaluation, render the fallback UI (or nothing)
  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  // Render the protected component
  return <>{children}</>;
};

export default RequirePermission;
