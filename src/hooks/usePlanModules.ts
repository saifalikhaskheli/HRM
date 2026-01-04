import { useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { ModuleId, HR_MODULES } from '@/config/modules';

/**
 * Plan-based module access information
 * 
 * SECURITY NOTE: Module access is enforced server-side via RLS policies
 * that check company_has_module() and can_use_module() functions.
 * This hook is for UI rendering only.
 */
export interface PlanModulesInfo {
  /** Current plan name */
  planName: string | null;
  /** Modules available in current plan */
  availableModules: ModuleId[] | 'all';
  /** Check if a specific module is available in plan */
  hasModule: (moduleId: ModuleId) => boolean;
  /** Get list of module IDs available in plan */
  moduleIds: ModuleId[];
  /** Whether plan includes all modules */
  isUnlimitedPlan: boolean;
  /** Modules that are locked (not in plan) */
  lockedModules: ModuleId[];
  /** Whether currently on trial */
  isTrialing: boolean;
  /** Days remaining in trial (null if not trialing) */
  trialDaysRemaining: number | null;
  /** Loading state */
  isLoading: boolean;
}

export function usePlanModules(): PlanModulesInfo {
  const { 
    planName, 
    planModules, 
    hasModule, 
    isTrialing, 
    trialDaysRemaining,
    isLoading 
  } = useTenant();

  return useMemo<PlanModulesInfo>(() => {
    const isUnlimitedPlan = planModules === 'all';
    const allModuleIds = HR_MODULES.map(m => m.id);
    
    const moduleIds: ModuleId[] = isUnlimitedPlan 
      ? allModuleIds 
      : (planModules as ModuleId[]);

    const lockedModules: ModuleId[] = isUnlimitedPlan
      ? []
      : allModuleIds.filter(id => !moduleIds.includes(id));

    return {
      planName,
      availableModules: planModules,
      hasModule,
      moduleIds,
      isUnlimitedPlan,
      lockedModules,
      isTrialing,
      trialDaysRemaining,
      isLoading,
    };
  }, [planName, planModules, hasModule, isTrialing, trialDaysRemaining, isLoading]);
}
