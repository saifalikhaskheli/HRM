import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole, hasMinimumRole, ROLE_HIERARCHY } from '@/types/auth';

/**
 * User role information and permission checks
 * 
 * SECURITY NOTE: These checks are for UI purposes only.
 * All permission enforcement happens server-side via RLS policies
 * and database functions (is_company_admin, is_hr_or_above, etc.)
 */
export interface UserRoleInfo {
  /** Current user's role in the company */
  role: AppRole | null;
  /** Role hierarchy level (higher = more permissions) */
  roleLevel: number;
  /** Whether user has at least the specified role */
  hasMinimumRole: (requiredRole: AppRole) => boolean;
  
  // Convenience role checks
  /** User is super_admin (system owner) */
  isSuperAdmin: boolean;
  /** User is company_admin or higher */
  isCompanyAdmin: boolean;
  /** User is hr_manager or higher */
  isHRManager: boolean;
  /** User is hr_manager or higher (alias) */
  isHROrAbove: boolean;
  /** User is manager or higher */
  isManager: boolean;
  /** User is employee (lowest role level) */
  isEmployee: boolean;
  
  // Permission checks (mirrors backend functions)
  /** Can manage company users (company_admin+) */
  canManageUsers: boolean;
  /** Can manage HR functions (hr_manager+) */
  canManageHR: boolean;
  /** Can view reports (manager+) */
  canViewReports: boolean;
  /** Can access settings (company_admin+) */
  canAccessSettings: boolean;
  /** Can access billing (company_admin+) */
  canAccessBilling: boolean;
}

export function useUserRole(): UserRoleInfo {
  const { currentRole } = useAuth();

  return useMemo<UserRoleInfo>(() => {
    const role = currentRole;
    const roleLevel = role ? ROLE_HIERARCHY[role] : 0;

    return {
      role,
      roleLevel,
      hasMinimumRole: (requiredRole: AppRole) => hasMinimumRole(role, requiredRole),
      
      // Role checks
      isSuperAdmin: role === 'super_admin',
      isCompanyAdmin: hasMinimumRole(role, 'company_admin'),
      isHRManager: hasMinimumRole(role, 'hr_manager'),
      isHROrAbove: hasMinimumRole(role, 'hr_manager'),
      isManager: hasMinimumRole(role, 'manager'),
      isEmployee: role === 'employee',
      
      // Permission checks
      canManageUsers: hasMinimumRole(role, 'company_admin'),
      canManageHR: hasMinimumRole(role, 'hr_manager'),
      canViewReports: hasMinimumRole(role, 'manager'),
      canAccessSettings: hasMinimumRole(role, 'company_admin'),
      canAccessBilling: hasMinimumRole(role, 'company_admin'),
    };
  }, [currentRole]);
}
