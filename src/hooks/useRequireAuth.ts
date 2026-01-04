import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { AppRole, hasMinimumRole } from '@/types/auth';

interface UseRequireAuthOptions {
  redirectTo?: string;
  requiredRole?: AppRole;
  requireCompany?: boolean;
}

export const useRequireAuth = (options: UseRequireAuthOptions = {}) => {
  const { 
    redirectTo = '/auth', 
    requiredRole,
    requireCompany = false 
  } = options;
  
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, currentRole, currentCompanyId, isPlatformAdmin, user } = useAuth();
  const { isImpersonating, effectiveCompanyId } = useImpersonation();

  // When impersonating, use the effective company ID instead of the user's actual company
  const activeCompanyId = isImpersonating ? effectiveCompanyId : currentCompanyId;
  // When impersonating, treat as admin role for access purposes
  const activeRole = isImpersonating && isPlatformAdmin ? 'company_admin' as AppRole : currentRole;

  useEffect(() => {
    // CRITICAL: Wait for BOTH auth loading AND user context to be fully resolved
    // isLoading now includes user context loading state
    if (isLoading) return;

    // If not authenticated at all, redirect to auth
    if (!isAuthenticated) {
      navigate(redirectTo, { replace: true });
      return;
    }

    // Wait for user context to be available before making decisions
    // This prevents premature redirects while user data is still loading
    if (isAuthenticated && user === null) {
      // User context is still loading even though session exists
      // This should be covered by isLoading, but add safety check
      return;
    }

    // Allow impersonating platform admins to access company pages
    if (requireCompany && !activeCompanyId) {
      // Only redirect to onboarding if not impersonating
      if (!isImpersonating) {
        navigate('/onboarding', { replace: true });
      }
      return;
    }

    if (requiredRole && !hasMinimumRole(activeRole, requiredRole)) {
      navigate('/unauthorized', { replace: true });
      return;
    }
  }, [isAuthenticated, isLoading, activeRole, activeCompanyId, navigate, redirectTo, requiredRole, requireCompany, isImpersonating, user]);

  return { 
    isLoading: isLoading || (isAuthenticated && user === null), 
    isAuthenticated, 
    currentRole: activeRole, 
    currentCompanyId: activeCompanyId 
  };
};
