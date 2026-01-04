import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface WriteGuardProps {
  children: React.ReactNode;
  /** What to render when writes are blocked - defaults to disabled version of children */
  fallback?: React.ReactNode;
  /** Whether to show a toast when blocked */
  showToast?: boolean;
  /** Custom message for the toast */
  toastMessage?: string;
  /** Whether to show tooltip on hover when blocked (default: true) */
  showTooltip?: boolean;
}

/**
 * Wrapper component that disables interactive elements when write operations are blocked.
 * This is triggered when:
 * - Company is frozen
 * - Trial has expired
 * - Subscription is past due
 * - Subscription is paused or canceled
 * 
 * SECURITY NOTE: This is UI-only. Server-side RLS policies enforce the actual restriction.
 */
export function WriteGuard({
  children,
  fallback,
  showToast = false,
  showTooltip = true,
  toastMessage,
}: WriteGuardProps) {
  const { canWrite, isFrozen, isTrialExpired, isPastDue, effectiveStatus } = useTenant();

  if (canWrite) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Determine appropriate message
  const getMessage = () => {
    if (toastMessage) return toastMessage;
    if (isFrozen) return 'Account frozen. Update billing to make changes.';
    if (isTrialExpired) return 'Trial expired. Upgrade to continue.';
    if (isPastDue) return 'Payment past due. Update billing to make changes.';
    if (effectiveStatus === 'paused') return 'Subscription paused. Reactivate to make changes.';
    if (effectiveStatus === 'canceled') return 'Subscription canceled. Subscribe to make changes.';
    return 'You cannot make changes at this time.';
  };

  // Wrap children with a click handler that shows a toast and prevents default
  const handleBlockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showToast) {
      toast.error(getMessage());
    }
  };

  const blockedContent = (
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

  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {blockedContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{getMessage()}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return blockedContent;
}

/**
 * Hook version for more granular control
 */
export function useWriteGuard() {
  const { canWrite, isFrozen, isTrialExpired, isPastDue, effectiveStatus } = useTenant();

  const getMessage = () => {
    if (isFrozen) return 'Your account is frozen. Please update billing to make changes.';
    if (isTrialExpired) return 'Your trial has expired. Please upgrade to continue.';
    if (isPastDue) return 'Your payment is past due. Please update billing to make changes.';
    if (effectiveStatus === 'paused') return 'Your subscription is paused. Please reactivate to make changes.';
    if (effectiveStatus === 'canceled') return 'Your subscription is canceled. Please subscribe to make changes.';
    return 'You cannot make changes at this time.';
  };

  const guardAction = <T extends (...args: unknown[]) => unknown>(
    action: T,
    customMessage?: string
  ): T => {
    if (canWrite) return action;

    return ((...args: Parameters<T>) => {
      toast.error(customMessage || getMessage());
      return undefined;
    }) as T;
  };

  return {
    canWrite,
    isFrozen,
    isTrialExpired,
    isPastDue,
    effectiveStatus,
    guardAction,
    showBlockedToast: () => {
      if (!canWrite) {
        toast.error(getMessage());
      }
      return !canWrite;
    },
  };
}
