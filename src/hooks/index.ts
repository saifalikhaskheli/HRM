// Authentication hooks
export { useAuth } from './useAuth';
export { useRequireAuth } from './useRequireAuth';

// Company hooks
export { useCompany, useCurrentCompany } from './useCompany';

// Authorization hooks
export { useUserRole, type UserRoleInfo } from './useUserRole';
export { usePlanModules, type PlanModulesInfo } from './usePlanModules';
export { useIsFrozen, useDisableWrites, type FrozenState } from './useIsFrozen';
export { useModuleAccess, type ModuleAccess } from './useModuleAccess';
export { usePlans, useSubscription, useChangePlan, useFreezeCompany, useSubscriptionHealth } from './useSubscription';

// Security hooks
export { useSecurityLogger } from './useSecurityLogger';
export { useSessionTimeout } from './useSessionTimeout';

// Domain hooks
export { useBaseDomain } from './useBaseDomain';
export { useDomainCompany } from './useDomainCompany';
export { useCompanyPrimaryDomain } from './useCompanyPrimaryDomain';
export { useSubdomainHealth } from './useSubdomainHealth';

// Data hooks
export { useEmployees } from './useEmployees';
export { useDepartments } from './useDepartments';
export { useAllDocuments, useMyDocuments, useDocumentTypes } from './useDocuments';
export { useDashboardStats } from './useDashboardStats';

// UI hooks
export { useIsMobile } from './use-mobile';
