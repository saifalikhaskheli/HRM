import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

interface FrozenGuardProps {
  children: React.ReactNode;
  /** What to render when frozen - defaults to disabled version of children */
  fallback?: React.ReactNode;
  /** Whether to show a toast when blocked */
  showToast?: boolean;
  /** Custom message for the toast */
  toastMessage?: string;
}

/**
 * Wrapper component that disables interactive elements when company is frozen
 * OR when trial has expired.
 * Use this to wrap buttons, forms, and other interactive elements that should
 * be read-only when the company account is frozen or trial expired.
 * 
 * SECURITY NOTE: This is UI-only. Server-side RLS policies enforce the actual restriction.
 */
export function FrozenGuard({
  children,
  fallback,
  showToast = true,
  toastMessage,
}: FrozenGuardProps) {
  const { isFrozen, isTrialExpired, canWrite } = useTenant();

  // Allow if writes are permitted
  if (canWrite) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Determine appropriate message
  const getMessage = () => {
    if (toastMessage) return toastMessage;
    if (isFrozen) return 'Your account is frozen. Please update billing to make changes.';
    if (isTrialExpired) return 'Your trial has expired. Please upgrade to continue.';
    return 'You cannot make changes at this time.';
  };

  // Wrap children with a click handler that shows a toast and prevents default
  const handleFrozenClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showToast) {
      toast.error(getMessage());
    }
  };

  return (
    <div 
      onClick={handleFrozenClick}
      className="cursor-not-allowed opacity-50"
      role="presentation"
    >
      <div className="pointer-events-none">
        {children}
      </div>
    </div>
  );
}

/**
 * Hook version for more granular control
 */
export function useFrozenAction() {
  const { isFrozen, isTrialExpired, canWrite } = useTenant();

  const guardAction = <T extends (...args: unknown[]) => unknown>(
    action: T,
    message?: string
  ): T => {
    if (canWrite) return action;

    const defaultMessage = isFrozen 
      ? 'Your account is frozen. Please update billing to make changes.'
      : isTrialExpired
      ? 'Your trial has expired. Please upgrade to continue.'
      : 'You cannot make changes at this time.';

    return ((...args: Parameters<T>) => {
      toast.error(message || defaultMessage);
      return undefined;
    }) as T;
  };

  return {
    isFrozen,
    isTrialExpired,
    canWrite,
    guardAction,
    showFrozenToast: () => {
      if (!canWrite) {
        const message = isFrozen 
          ? 'Your account is frozen. Please update billing to make changes.'
          : isTrialExpired
          ? 'Your trial has expired. Please upgrade to continue.'
          : 'You cannot make changes at this time.';
        toast.error(message);
      }
      return !canWrite;
    },
  };
}
