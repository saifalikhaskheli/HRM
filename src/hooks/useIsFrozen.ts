import { useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useUserRole } from './useUserRole';

/**
 * Company frozen state hook
 * 
 * SECURITY NOTE: Frozen state is enforced server-side.
 * RLS policies check is_company_active() before allowing writes.
 * This hook is for UI rendering (showing frozen banner, disabling buttons).
 */
export interface FrozenState {
  /** Whether the company is currently frozen */
  isFrozen: boolean;
  /** Whether the current user can update billing to unfreeze */
  canUpdateBilling: boolean;
  /** Whether to show the frozen banner */
  showFrozenBanner: boolean;
  /** Message to display when frozen */
  frozenMessage: string;
  /** Whether write operations should be disabled in UI */
  disableWrites: boolean;
  /** Loading state */
  isLoading: boolean;
}

export function useIsFrozen(): FrozenState {
  const { isFrozen, isLoading } = useTenant();
  const { canAccessBilling } = useUserRole();

  return useMemo<FrozenState>(() => {
    return {
      isFrozen,
      canUpdateBilling: canAccessBilling,
      showFrozenBanner: isFrozen,
      frozenMessage: canAccessBilling
        ? 'Your account is frozen due to billing issues. Please update your payment method to restore access.'
        : 'Your account is currently frozen. Please contact your administrator.',
      disableWrites: isFrozen,
      isLoading,
    };
  }, [isFrozen, canAccessBilling, isLoading]);
}

/**
 * Simple hook to check if writes should be disabled
 * Useful for quickly disabling form submissions and action buttons
 */
export function useDisableWrites(): boolean {
  const { isFrozen } = useTenant();
  return isFrozen;
}
