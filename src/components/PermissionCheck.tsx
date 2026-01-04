import React from 'react';
import { PermissionModule, PermissionAction, ACTION_LABELS } from '@/types/permissions';
import { usePermission } from '@/contexts/PermissionContext';
import { Lock, Crown, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PermissionCheckProps {
  /** Module to check permission for */
  module: PermissionModule;
  /** Action to check permission for */
  action: PermissionAction;
  /** What to render when access is denied */
  fallback?: 'hide' | 'disable' | 'lock-icon' | React.ReactNode;
  /** Custom message when access denied */
  deniedMessage?: string;
  /** Children to render when access granted */
  children: React.ReactNode;
}

/**
 * PermissionCheck - Conditionally render content based on fine-grained permissions
 * 
 * This component uses the new advanced permission system which checks:
 * 1. Explicit user permission overrides (allow/deny)
 * 2. Role-based permissions
 * 3. Super admin bypass
 * 
 * SECURITY NOTE: This is for UI rendering only. All permission enforcement
 * happens server-side via RLS policies and database functions.
 */
export function PermissionCheck({
  module,
  action,
  fallback = 'hide',
  deniedMessage,
  children,
}: PermissionCheckProps) {
  const { can, isLoading } = usePermission();

  // While loading, show nothing to prevent flash
  if (isLoading) {
    return null;
  }

  const hasAccess = can(module, action);
  const displayMessage = deniedMessage || `You don't have permission to ${ACTION_LABELS[action].toLowerCase()} ${module.replace('_', ' ')}`;

  // Access granted
  if (hasAccess) {
    return <>{children}</>;
  }

  // Handle different fallback modes
  if (fallback === 'hide') {
    return null;
  }

  if (fallback === 'disable') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="opacity-50 cursor-not-allowed pointer-events-none"
            aria-disabled="true"
          >
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{displayMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (fallback === 'lock-icon') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 opacity-50 cursor-not-allowed">
            {children}
            <Lock className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{displayMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Custom fallback component
  return <>{fallback}</>;
}

/**
 * WithPermission - Higher-order component for permission checking
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  module: PermissionModule,
  action: PermissionAction,
  fallback: PermissionCheckProps['fallback'] = 'hide'
) {
  return function WithPermissionWrapper(props: P) {
    return (
      <PermissionCheck module={module} action={action} fallback={fallback}>
        <WrappedComponent {...props} />
      </PermissionCheck>
    );
  };
}

/**
 * useCanDo - Hook for checking multiple permissions at once
 */
export function useCanDo(checks: Array<{ module: PermissionModule; action: PermissionAction }>) {
  const { can } = usePermission();
  
  return checks.map(({ module, action }) => can(module, action));
}

export default PermissionCheck;
