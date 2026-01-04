import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useImpersonation } from './ImpersonationContext';
import { useCompany } from '@/hooks/useCompany';
import { AppRole, hasMinimumRole, canManageUsers, canManageHR, canViewReports, CurrentEmployee } from '@/types/auth';
import { ModuleId } from '@/config/modules';
import { SubscriptionStatus } from '@/types/company';

interface TenantContextValue {
  // Company info
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  companyLogoUrl: string | null;
  
  // User role
  role: AppRole | null;
  employeeId: string | null;
  currentEmployee: CurrentEmployee | null;
  
  // Role checks
  isOwner: boolean;
  isAdmin: boolean;
  isHR: boolean;
  isManager: boolean;
  canManageUsers: boolean;
  canManageHR: boolean;
  canViewReports: boolean;
  
  // Company state
  isFrozen: boolean;
  isTrialing: boolean;
  isTrialExpired: boolean;
  isPastDue: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  effectiveStatus: SubscriptionStatus | null;
  trialDaysRemaining: number | null;
  trialTotalDays: number | null;
  
  // Access control
  canWrite: boolean;
  
  // Plan info
  planName: string | null;
  planModules: ModuleId[] | 'all' | null;
  hasModule: (module: ModuleId) => boolean;
  
  // Impersonation
  isImpersonating: boolean;
  
  // Loading state
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, currentCompanyId, currentRole, isLoading: authLoading, isPlatformAdmin } = useAuth();
  const { isImpersonating, impersonatedCompany, effectiveCompanyId } = useImpersonation();
  
  // When impersonating, use the impersonated company ID
  const activeCompanyId = isImpersonating ? effectiveCompanyId : currentCompanyId;
  
  const { data: company, isLoading: companyLoading } = useCompany(activeCompanyId);

  const currentCompany = useMemo(() => {
    // When impersonating, create a virtual company entry
    if (isImpersonating && impersonatedCompany) {
      return {
        company_id: impersonatedCompany.id,
        company_name: impersonatedCompany.name,
        company_slug: impersonatedCompany.slug,
      };
    }
    
    if (!user?.companies || !currentCompanyId) return null;
    return user.companies.find(c => c.company_id === currentCompanyId) || null;
  }, [user?.companies, currentCompanyId, isImpersonating, impersonatedCompany]);

  const planModules = useMemo((): ModuleId[] | 'all' | null => {
    const modules = company?.subscription?.features?.modules;
    if (modules === 'all') return 'all';
    if (Array.isArray(modules) && modules.length > 0) return modules as ModuleId[];
    // Return null if no plan modules defined - this means no restrictions
    return null;
  }, [company?.subscription?.features?.modules]);

  const hasModule = (module: ModuleId): boolean => {
    // 'all' means all modules included
    if (planModules === 'all') return true;
    // null means no plan restrictions configured - allow all
    if (planModules === null) return true;
    // Otherwise check if module is in the plan's module list
    return planModules.includes(module);
  };

  const trialDaysRemaining = useMemo((): number | null => {
    if (!company?.subscription?.trial_ends_at) return null;
    const trialEnd = new Date(company.subscription.trial_ends_at);
    const now = new Date();
    const diffDays = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [company?.subscription?.trial_ends_at]);

  // Get trial total days from subscription (with fallback to 14 for backwards compat)
  const trialTotalDays = useMemo((): number | null => {
    if (!company?.subscription?.trial_ends_at) return null;
    // Use trial_total_days from subscription if available, else default to 14
    return (company?.subscription as unknown as { trial_total_days?: number })?.trial_total_days || 14;
  }, [company?.subscription]);

  // When impersonating, grant admin-like view access
  const effectiveRole = isImpersonating && isPlatformAdmin ? 'company_admin' as AppRole : currentRole;

  const value = useMemo<TenantContextValue>(() => {
    const subscriptionStatus = company?.subscription?.status || null;
    const isPastDue = subscriptionStatus === 'past_due';
    const isFrozen = company ? !company.is_active : false;
    
    // Real-time trial expiry check - if status is trialing but trial_ends_at is in the past
    const isTrialExpired = 
      subscriptionStatus === 'trialing' &&
      company?.subscription?.trial_ends_at &&
      new Date(company.subscription.trial_ends_at) < new Date();
    
    // Effective status considers real-time trial expiry
    const effectiveStatus: SubscriptionStatus | null = isTrialExpired 
      ? 'trial_expired' 
      : subscriptionStatus;
    
    // Can write: company active AND subscription allows writes
    const canWrite = 
      !isFrozen && 
      !isTrialExpired &&
      subscriptionStatus !== 'past_due' &&
      subscriptionStatus !== 'paused' &&
      subscriptionStatus !== 'canceled' &&
      subscriptionStatus !== 'trial_expired';

    return {
      // Company info
      companyId: activeCompanyId,
      companyName: currentCompany?.company_name || company?.name || null,
      companySlug: currentCompany?.company_slug || company?.slug || null,
      companyLogoUrl: company?.logo_url || null,
      
      // User role
      role: effectiveRole,
      employeeId: isImpersonating ? null : (user?.current_employee_id || null),
      currentEmployee: isImpersonating ? null : (user?.current_employee || null),
      
      // Role checks - when impersonating, grant view access
      isOwner: isImpersonating ? false : effectiveRole === 'super_admin',
      isAdmin: isImpersonating ? true : hasMinimumRole(effectiveRole, 'company_admin'),
      isHR: isImpersonating ? true : hasMinimumRole(effectiveRole, 'hr_manager'),
      isManager: isImpersonating ? true : hasMinimumRole(effectiveRole, 'manager'),
      canManageUsers: isImpersonating ? false : canManageUsers(effectiveRole),
      canManageHR: isImpersonating ? false : canManageHR(effectiveRole),
      canViewReports: isImpersonating ? true : canViewReports(effectiveRole),
      
      // Company state
      isFrozen,
      isTrialing: subscriptionStatus === 'trialing' && !isTrialExpired,
      isTrialExpired,
      isPastDue,
      subscriptionStatus,
      effectiveStatus,
      trialDaysRemaining: isTrialExpired ? 0 : trialDaysRemaining,
      trialTotalDays,
      
      // Access control
      canWrite,
      
      // Plan info
      planName: company?.subscription?.plan_name || null,
      planModules,
      hasModule,
      
      // Impersonation
      isImpersonating,
      
      // Loading
      isLoading: authLoading || companyLoading,
    };
  }, [
    activeCompanyId, 
    currentCompany, 
    company, 
    effectiveRole, 
    user?.current_employee_id,
    user?.current_employee,
    planModules,
    trialDaysRemaining,
    trialTotalDays,
    authLoading,
    companyLoading,
    isImpersonating,
  ]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
