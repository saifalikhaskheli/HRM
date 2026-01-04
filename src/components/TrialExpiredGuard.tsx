import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

interface TrialExpiredGuardProps {
  children: React.ReactNode;
  /** What to render when trial expired - defaults to disabled version of children */
  fallback?: React.ReactNode;
  /** Whether to show a toast when blocked */
  showToast?: boolean;
  /** Custom message for the toast */
  toastMessage?: string;
}

/**
 * Wrapper component that disables interactive elements when trial has expired.
 * Use this to wrap buttons, forms, and other interactive elements that should
 * be read-only when the trial has expired.
 * 
 * SECURITY NOTE: This is UI-only. Server-side RLS policies enforce the actual restriction.
 */
export function TrialExpiredGuard({
  children,
  fallback,
  showToast = true,
  toastMessage = 'Your trial has expired. Please upgrade to continue.',
}: TrialExpiredGuardProps) {
  const { isTrialExpired } = useTenant();

  if (!isTrialExpired) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Wrap children with a click handler that shows a toast and prevents default
  const handleBlockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showToast) {
      toast.error(toastMessage);
    }
  };

  return (
    <div 
      onClick={handleBlockedClick}
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
export function useTrialExpiredAction() {
  const { isTrialExpired } = useTenant();

  const guardAction = <T extends (...args: unknown[]) => unknown>(
    action: T,
    message = 'Your trial has expired. Please upgrade to continue.'
  ): T => {
    if (!isTrialExpired) return action;

    return ((...args: Parameters<T>) => {
      toast.error(message);
      return undefined;
    }) as T;
  };

  return {
    isTrialExpired,
    guardAction,
    showTrialExpiredToast: () => {
      if (isTrialExpired) {
        toast.error('Your trial has expired. Please upgrade to continue.');
      }
      return isTrialExpired;
    },
  };
}
