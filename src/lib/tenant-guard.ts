import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

/**
 * Hook to ensure multi-tenant data isolation
 * Provides validated company_id and helper functions
 */
export function useTenantGuard() {
  const { companyId, isFrozen, hasModule } = useTenant();
  const { isAuthenticated } = useAuth();

  /**
   * Ensure company context exists before data operations
   */
  const requireCompany = useCallback(() => {
    if (!isAuthenticated) {
      throw new Error('Authentication required');
    }
    if (!companyId) {
      throw new Error('No company selected');
    }
    return companyId;
  }, [isAuthenticated, companyId]);

  /**
   * Ensure company is not frozen before write operations
   */
  const requireActiveCompany = useCallback(() => {
    const id = requireCompany();
    if (isFrozen) {
      throw new Error('Company account is frozen. Please update billing.');
    }
    return id;
  }, [requireCompany, isFrozen]);

  /**
   * Ensure module access before operations
   */
  const requireModule = useCallback((moduleId: string) => {
    const id = requireCompany();
    if (!hasModule(moduleId as Parameters<typeof hasModule>[0])) {
      throw new Error(`Module "${moduleId}" is not available on your current plan`);
    }
    return id;
  }, [requireCompany, hasModule]);

  /**
   * Ensure module access and active company for write operations
   */
  const requireModuleWrite = useCallback((moduleId: string) => {
    const id = requireActiveCompany();
    if (!hasModule(moduleId as Parameters<typeof hasModule>[0])) {
      throw new Error(`Module "${moduleId}" is not available on your current plan`);
    }
    return id;
  }, [requireActiveCompany, hasModule]);

  /**
   * Validate that a record belongs to the current company
   */
  const validateOwnership = useCallback((recordCompanyId: string | null | undefined) => {
    const currentCompanyId = requireCompany();
    if (!recordCompanyId || recordCompanyId !== currentCompanyId) {
      throw new Error('Access denied: Record does not belong to your company');
    }
    return true;
  }, [requireCompany]);

  return {
    companyId,
    isAuthenticated,
    isFrozen,
    requireCompany,
    requireActiveCompany,
    requireModule,
    requireModuleWrite,
    validateOwnership,
    hasModule,
  };
}

/**
 * Type guard to ensure company_id is present in insert operations
 */
export type WithCompanyId<T> = T & { company_id: string };

/**
 * Helper to add company_id to insert data
 */
export function withCompanyId<T extends object>(
  data: T, 
  companyId: string
): WithCompanyId<T> {
  return { ...data, company_id: companyId };
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Sanitize and validate ID before database operations
 */
export function validateId(id: string | null | undefined, fieldName = 'ID'): string {
  if (!id) {
    throw new Error(`${fieldName} is required`);
  }
  if (!isValidUUID(id)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
  return id;
}
