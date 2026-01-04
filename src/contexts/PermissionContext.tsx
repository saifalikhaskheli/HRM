import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useMyPermissions } from '@/hooks/usePermissions';
import { useTenant } from './TenantContext';
import { PermissionModule, PermissionAction, UserPermission } from '@/types/permissions';

interface PermissionContextValue {
  // Core permission check
  can: (module: PermissionModule, action: PermissionAction) => boolean;
  
  // Module access check
  canAccessModule: (module: PermissionModule) => boolean;
  
  // Get all permissions for a module
  getModulePermissions: (module: PermissionModule) => UserPermission[];
  
  // All permissions
  permissions: UserPermission[] | undefined;
  
  // Loading state
  isLoading: boolean;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
};

// Shorthand hook for checking permissions
export const useCan = () => {
  const { can } = usePermission();
  return can;
};

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, isFrozen, isImpersonating } = useTenant();
  const { 
    permissions, 
    isLoading, 
    can: canFromHook, 
    canAccessModule: canAccessModuleFromHook,
    getModulePermissions: getModulePermissionsFromHook,
  } = useMyPermissions();

  // Enhanced can function that also checks frozen state
  const can = useCallback((module: PermissionModule, action: PermissionAction): boolean => {
    // Frozen accounts can only read
    if (isFrozen && action !== 'read') {
      return false;
    }
    
    // Impersonating users can only read
    if (isImpersonating && action !== 'read') {
      return false;
    }
    
    return canFromHook(module, action);
  }, [canFromHook, isFrozen, isImpersonating]);

  // Enhanced module access check
  const canAccessModule = useCallback((module: PermissionModule): boolean => {
    // Frozen accounts can still view (read) modules
    if (isFrozen) {
      return canFromHook(module, 'read');
    }
    
    return canAccessModuleFromHook(module);
  }, [canAccessModuleFromHook, canFromHook, isFrozen]);

  const value = useMemo<PermissionContextValue>(() => ({
    can,
    canAccessModule,
    getModulePermissions: getModulePermissionsFromHook,
    permissions,
    isLoading,
  }), [can, canAccessModule, getModulePermissionsFromHook, permissions, isLoading]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
