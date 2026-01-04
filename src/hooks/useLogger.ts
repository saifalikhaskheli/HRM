/**
 * React hook for logging with automatic context resolution
 * 
 * Provides logging methods that automatically include:
 * - Current company context
 * - Current user role
 * - Browser context
 */

import { useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  logger, 
  AuditLogParams, 
  SecurityLogParams, 
  ApplicationLogParams, 
  BillingLogParams,
  SupportAccessLogParams,
} from '@/lib/logger';

export function useLogger() {
  const { companyId, role } = useTenant();
  const { user } = useAuth();

  /**
   * Log an audit event with automatic context
   */
  const logAudit = useCallback((
    params: Omit<AuditLogParams, 'companyId'> & { companyId?: string }
  ) => {
    if (!companyId && !params.companyId) {
      console.warn('[useLogger] Cannot log audit event without company context');
      return;
    }

    logger.logAudit({
      ...params,
      companyId: params.companyId || companyId!,
      actorRole: params.actorRole || role || undefined,
    });
  }, [companyId, role]);

  /**
   * Log a security event with automatic context
   */
  const logSecurity = useCallback((
    params: Omit<SecurityLogParams, 'companyId'> & { companyId?: string | null }
  ) => {
    logger.logSecurity({
      ...params,
      companyId: params.companyId ?? companyId,
    });
  }, [companyId]);

  /**
   * Log an application event
   */
  const logApplication = useCallback((params: ApplicationLogParams) => {
    logger.logApplication({
      ...params,
      companyId: params.companyId || companyId || undefined,
    });
  }, [companyId]);

  /**
   * Log a billing event with automatic context
   */
  const logBilling = useCallback((
    params: Omit<BillingLogParams, 'companyId'> & { companyId?: string }
  ) => {
    if (!companyId && !params.companyId) {
      console.warn('[useLogger] Cannot log billing event without company context');
      return;
    }

    logger.logBilling({
      ...params,
      companyId: params.companyId || companyId!,
    });
  }, [companyId]);

  /**
   * Log support access event
   */
  const logSupportAccess = useCallback((params: SupportAccessLogParams) => {
    logger.logSupportAccess(params);
  }, []);

  // Convenience methods

  const logCreate = useCallback((
    tableName: string,
    recordId: string,
    newValues?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) => {
    logAudit({
      action: 'create',
      tableName,
      recordId,
      newValues,
      metadata,
    });
  }, [logAudit]);

  const logUpdate = useCallback((
    tableName: string,
    recordId: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) => {
    logAudit({
      action: 'update',
      tableName,
      recordId,
      oldValues,
      newValues,
      metadata,
    });
  }, [logAudit]);

  const logDelete = useCallback((
    tableName: string,
    recordId: string,
    oldValues?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) => {
    logAudit({
      action: 'delete',
      tableName,
      recordId,
      oldValues,
      metadata,
    });
  }, [logAudit]);

  const logExport = useCallback((
    tableName: string,
    recordCount: number,
    filters?: Record<string, unknown>
  ) => {
    logAudit({
      action: 'export',
      tableName,
      metadata: { record_count: recordCount, filters },
    });

    // Also log as security event for data export tracking
    logger.logDataExport(companyId!, tableName, recordCount);
  }, [logAudit, companyId]);

  const logLoginSuccess = useCallback((metadata?: Record<string, unknown>) => {
    logger.logLoginSuccess(companyId || undefined, metadata);
  }, [companyId]);

  const logPasswordChange = useCallback(() => {
    logger.logPasswordChange(companyId || undefined);
  }, [companyId]);

  const logMFAEnabled = useCallback(() => {
    logger.logMFAEnabled(companyId || undefined);
  }, [companyId]);

  const logMFADisabled = useCallback(() => {
    logger.logMFADisabled(companyId || undefined);
  }, [companyId]);

  const logPermissionChange = useCallback((
    targetUserId: string,
    action: string,
    details?: Record<string, unknown>
  ) => {
    if (!companyId) return;
    logger.logPermissionChange(companyId, targetUserId, action, details);
  }, [companyId]);

  const logError = useCallback((
    service: string,
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ) => {
    logger.logError(service, message, error, { ...context, company_id: companyId });
  }, [companyId]);

  return {
    // Core logging methods
    logAudit,
    logSecurity,
    logApplication,
    logBilling,
    logSupportAccess,

    // Audit convenience methods
    logCreate,
    logUpdate,
    logDelete,
    logExport,

    // Security convenience methods
    logLoginSuccess,
    logPasswordChange,
    logMFAEnabled,
    logMFADisabled,
    logPermissionChange,

    // Application convenience methods
    logError,

    // Flush pending logs
    flush: () => logger.flush(),
  };
}
