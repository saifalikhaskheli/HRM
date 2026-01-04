import { useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useCurrentCompany } from './useCompany';
import { useMyPermissions } from './usePermissions';
import { HR_MODULES, ModuleConfig, ModuleId } from '@/config/modules';
import { hasMinimumRole, AppRole } from '@/types/auth';
import { PermissionModule } from '@/types/permissions';

export interface ModuleAccess {
  module: ModuleConfig;
  hasAccess: boolean;
  reason: 'ok' | 'no_role' | 'no_plan' | 'frozen' | 'permission_granted';
}

// Map module IDs to permission modules (where they differ)
const MODULE_TO_PERMISSION: Record<string, PermissionModule> = {
  'dashboard': 'dashboard',
  'employees': 'employees',
  'departments': 'departments',
  'leave': 'leave',
  'time': 'time_tracking',
  'payroll': 'payroll',
  'performance': 'performance',
  'recruitment': 'recruitment',
  'documents': 'documents',
  'expenses': 'expenses',
  'compliance': 'compliance',
  'shifts': 'time_tracking',
};

export function useModuleAccess() {
  const { role, companyId } = useTenant();
  const { data: company, isLoading } = useCurrentCompany();
  const { canAccessModule: hasPermissionForModule, isLoading: permissionsLoading } = useMyPermissions();

  const isFrozen = company ? !company.is_active : false;
  const planModules = company?.subscription?.features?.modules;

  const hasModuleInPlan = (moduleId: ModuleId): boolean => {
    // If plan modules is 'all', grant access to everything
    if (planModules === 'all') return true;
    
    // If plan modules is an array, check if module is included
    if (Array.isArray(planModules) && planModules.length > 0) {
      return planModules.includes(moduleId);
    }
    
    // If no plan modules defined (undefined, null, or empty array), 
    // default to allowing access (no plan restrictions)
    // This prevents blank sidebars when subscription data is loading or not configured
    return true;
  };

  const moduleAccess = useMemo<ModuleAccess[]>(() => {
    return HR_MODULES.map((module) => {
      // Check if company is frozen
      if (isFrozen) {
        return { module, hasAccess: false, reason: 'frozen' as const };
      }

      // Check if user has explicit permission override for this module
      const permissionModule = MODULE_TO_PERMISSION[module.id];
      if (permissionModule && hasPermissionForModule(permissionModule)) {
        // User has explicit permission - grant access regardless of role
        // Still need to check plan access
        if (module.planRequired && !hasModuleInPlan(module.planRequired)) {
          return { module, hasAccess: false, reason: 'no_plan' as const };
        }
        return { module, hasAccess: true, reason: 'permission_granted' as const };
      }

      // Check role access
      if (!hasMinimumRole(role, module.minRole)) {
        return { module, hasAccess: false, reason: 'no_role' as const };
      }

      // Check plan access (if module requires a plan)
      if (module.planRequired && !hasModuleInPlan(module.planRequired)) {
        return { module, hasAccess: false, reason: 'no_plan' as const };
      }

      return { module, hasAccess: true, reason: 'ok' as const };
    });
  }, [role, isFrozen, planModules, hasPermissionForModule]);

  const accessibleModules = moduleAccess.filter((m) => m.hasAccess);
  const restrictedModules = moduleAccess.filter((m) => !m.hasAccess);

  const canAccessModule = (moduleId: ModuleId): boolean => {
    const access = moduleAccess.find((m) => m.module.id === moduleId);
    return access?.hasAccess || false;
  };

  return {
    moduleAccess,
    accessibleModules,
    restrictedModules,
    canAccessModule,
    isFrozen,
    planModules,
    isLoading: isLoading || permissionsLoading,
  };
}
