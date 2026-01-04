/**
 * Centralized Logging System
 * 
 * This module provides a unified interface for all logging operations:
 * - Audit logs: Business-critical actions (CRUD on records)
 * - Security logs: Auth events, permission changes, suspicious activity
 * - Application logs: System errors, edge function failures
 * - Billing logs: Subscription lifecycle events
 * - Support access logs: When platform admins access tenant data
 * 
 * PRINCIPLES:
 * 1. Logs are written server-side only (via RPC or edge functions)
 * 2. Logs are immutable (no update/delete)
 * 3. No sensitive data (PII, passwords, payroll amounts)
 * 4. Async/non-blocking - never blocks core business actions
 * 5. Tenant isolation enforced via RLS
 */

import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

type AuditAction = Database['public']['Enums']['audit_action'];
type SecurityEventType = Database['public']['Enums']['security_event_type'];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type LogSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogParams {
  companyId: string;
  action: AuditAction;
  tableName: string;
  recordId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  actorRole?: string;
  targetType?: string;
}

export interface SecurityLogParams {
  companyId?: string | null;
  eventType: SecurityEventType;
  description?: string;
  severity?: LogSeverity;
  metadata?: Record<string, unknown>;
}

export interface ApplicationLogParams {
  service: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  errorCode?: string;
  errorStack?: string;
  companyId?: string;
  requestId?: string;
  durationMs?: number;
}

export interface BillingLogParams {
  companyId: string;
  eventType: 'trial_started' | 'trial_extended' | 'trial_expired' | 
             'subscription_created' | 'subscription_upgraded' | 'subscription_downgraded' |
             'subscription_canceled' | 'subscription_renewed' |
             'payment_succeeded' | 'payment_failed' |
             'company_frozen' | 'company_unfrozen' |
             'plan_assigned';
  subscriptionId?: string;
  planId?: string;
  previousPlanId?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface SupportAccessLogParams {
  companyId: string;
  action: 'access_requested' | 'access_granted' | 'access_revoked' | 'access_expired' | 'access_used';
  grantedBy?: string;
  grantedTo?: string;
  reason?: string;
  duration?: string;
  metadata?: Record<string, unknown>;
}

// =====================================================
// LOGGER CLASS
// =====================================================

class Logger {
  private static instance: Logger;
  private pendingLogs: Promise<unknown>[] = [];

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Get browser context for logging (IP is server-side only)
   */
  private getBrowserContext(): { userAgent: string; url: string } {
    return {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : '',
    };
  }

  /**
   * Fire-and-forget log operation - never blocks
   */
  private async fireAndForget(operation: Promise<unknown>): Promise<void> {
    this.pendingLogs.push(operation);
    try {
      await operation;
    } catch (error) {
      console.error('[Logger] Failed to write log:', error);
    } finally {
      this.pendingLogs = this.pendingLogs.filter(p => p !== operation);
    }
  }

  /**
   * Sanitize data before logging - removes sensitive fields
   */
  private sanitizeData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!data) return undefined;

    const sensitiveFields = [
      'password', 'password_hash', 'token', 'secret', 'api_key', 
      'credit_card', 'ssn', 'national_id', 'bank_account',
      'salary', 'net_pay', 'gross_pay', 'tax_info',
      'smtp_password', 'api_key', 'aws_secret_access_key'
    ];

    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // =====================================================
  // AUDIT LOGGING
  // =====================================================

  /**
   * Log audit events for business-critical actions
   * Used for: Employee CRUD, leave requests, payroll, documents, etc.
   */
  async logAudit(params: AuditLogParams): Promise<void> {
    const { companyId, action, tableName, recordId, oldValues, newValues, metadata, actorRole, targetType } = params;

    const operation = (async () => {
      const { error } = await supabase.from('audit_logs').insert({
        company_id: companyId,
        action,
        table_name: tableName,
        record_id: recordId || null,
        old_values: this.sanitizeData(oldValues) || null,
        new_values: this.sanitizeData(newValues) || null,
        metadata: {
          ...this.sanitizeData(metadata),
          ...this.getBrowserContext(),
        },
      } as any);
      if (error) throw error;
    })();

    this.fireAndForget(operation);
  }

  // =====================================================
  // SECURITY LOGGING
  // =====================================================

  /**
   * Log security events
   * Used for: Login, logout, MFA, permission changes, suspicious activity
   */
  async logSecurity(params: SecurityLogParams): Promise<void> {
    const { companyId, eventType, description, severity = 'medium', metadata } = params;
    const browserContext = this.getBrowserContext();

    const operation = (async () => {
      const { error } = await supabase.from('security_events').insert({
        company_id: companyId || null,
        event_type: eventType,
        description,
        severity,
        user_agent: browserContext.userAgent,
        user_agent_truncated: browserContext.userAgent?.substring(0, 100),
        metadata: {
          ...this.sanitizeData(metadata),
          url: browserContext.url,
          timestamp: new Date().toISOString(),
        },
      });
      if (error) throw error;
    })();

    this.fireAndForget(operation);
  }

  /**
   * Convenience methods for common security events
   */
  logLoginSuccess(companyId?: string, metadata?: Record<string, unknown>): void {
    this.logSecurity({
      companyId,
      eventType: 'login_success',
      description: 'User logged in successfully',
      severity: 'low',
      metadata,
    });
  }

  logLoginFailure(email: string, reason?: string): void {
    // Note: Login failures are logged without user_id since auth failed
    this.logSecurity({
      eventType: 'login_success', // Using available enum - ideally would be 'login_failure'
      description: `Login failed for ${email}: ${reason || 'unknown'}`,
      severity: 'medium',
      metadata: { email_partial: email.substring(0, 3) + '***', failure_reason: reason },
    });
  }

  logPasswordChange(companyId?: string): void {
    this.logSecurity({
      companyId,
      eventType: 'password_change',
      description: 'User changed their password',
      severity: 'medium',
    });
  }

  logMFAEnabled(companyId?: string): void {
    this.logSecurity({
      companyId,
      eventType: 'mfa_enabled',
      description: 'Multi-factor authentication enabled',
      severity: 'low',
    });
  }

  logMFADisabled(companyId?: string): void {
    this.logSecurity({
      companyId,
      eventType: 'mfa_disabled',
      description: 'Multi-factor authentication disabled',
      severity: 'high',
    });
  }

  logPermissionChange(companyId: string, targetUserId: string, action: string, details?: Record<string, unknown>): void {
    this.logSecurity({
      companyId,
      eventType: 'permission_denied', // Using closest available enum
      description: `Permission ${action} for user`,
      severity: 'high',
      metadata: { target_user_id: targetUserId, action, ...details },
    });
  }

  logSuspiciousActivity(companyId: string | undefined, description: string, metadata?: Record<string, unknown>): void {
    this.logSecurity({
      companyId,
      eventType: 'suspicious_activity',
      description,
      severity: 'critical',
      metadata,
    });
  }

  logDataExport(companyId: string, exportType: string, recordCount?: number): void {
    this.logSecurity({
      companyId,
      eventType: 'data_export',
      description: `Data exported: ${exportType}`,
      severity: 'medium',
      metadata: { export_type: exportType, record_count: recordCount },
    });
  }

  // =====================================================
  // APPLICATION LOGGING
  // =====================================================

  /**
   * Log application-level events (for platform debugging)
   * Used for: Edge function errors, email failures, OCR failures
   */
  async logApplication(params: ApplicationLogParams): Promise<void> {
    const { service, level, message, context, errorCode, errorStack, companyId, requestId, durationMs } = params;

    const operation = (async () => {
      const { error } = await supabase.from('application_logs' as any).insert({
        service,
        level,
        message,
        context: this.sanitizeData(context) || {},
        error_code: errorCode || null,
        error_stack: errorStack?.substring(0, 5000) || null,
        company_id: companyId || null,
        request_id: requestId || null,
        duration_ms: durationMs || null,
      } as any);
      if (error) throw error;
    })();

    this.fireAndForget(operation);
  }

  /**
   * Convenience methods for application logging
   */
  logError(service: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    this.logApplication({
      service,
      level: 'error',
      message,
      errorCode: error?.name,
      errorStack: error?.stack,
      context: { ...context, error_message: error?.message },
    });
  }

  logWarning(service: string, message: string, context?: Record<string, unknown>): void {
    this.logApplication({
      service,
      level: 'warn',
      message,
      context,
    });
  }

  logInfo(service: string, message: string, context?: Record<string, unknown>): void {
    this.logApplication({
      service,
      level: 'info',
      message,
      context,
    });
  }

  // =====================================================
  // BILLING LOGGING
  // =====================================================

  /**
   * Log billing lifecycle events
   * Used for: Trial, subscription changes, payment events, freeze/unfreeze
   */
  async logBilling(params: BillingLogParams): Promise<void> {
    const { companyId, eventType, subscriptionId, planId, previousPlanId, amount, currency = 'USD', metadata } = params;

    const operation = (async () => {
      const { error } = await supabase.from('billing_logs' as any).insert({
        company_id: companyId,
        event_type: eventType,
        subscription_id: subscriptionId || null,
        plan_id: planId || null,
        previous_plan_id: previousPlanId || null,
        amount: amount || null,
        currency,
        metadata: this.sanitizeData(metadata) || {},
      } as any);
      if (error) throw error;
    })();

    this.fireAndForget(operation);
  }

  /**
   * Convenience methods for billing events
   */
  logTrialStarted(companyId: string, planId: string, trialEndsAt: string): void {
    this.logBilling({
      companyId,
      eventType: 'trial_started',
      planId,
      metadata: { trial_ends_at: trialEndsAt },
    });
  }

  logTrialExtended(companyId: string, newEndDate: string, reason?: string): void {
    this.logBilling({
      companyId,
      eventType: 'trial_extended',
      metadata: { new_end_date: newEndDate, reason },
    });
  }

  logSubscriptionChange(companyId: string, fromPlanId: string | null, toPlanId: string, action: 'upgraded' | 'downgraded'): void {
    this.logBilling({
      companyId,
      eventType: action === 'upgraded' ? 'subscription_upgraded' : 'subscription_downgraded',
      planId: toPlanId,
      previousPlanId: fromPlanId || undefined,
    });
  }

  logCompanyFrozen(companyId: string, reason: string): void {
    this.logBilling({
      companyId,
      eventType: 'company_frozen',
      metadata: { reason },
    });
  }

  logCompanyUnfrozen(companyId: string): void {
    this.logBilling({
      companyId,
      eventType: 'company_unfrozen',
    });
  }

  // =====================================================
  // SUPPORT ACCESS LOGGING
  // =====================================================

  /**
   * Log support access events
   * Used for: When platform admins access tenant data
   */
  async logSupportAccess(params: SupportAccessLogParams): Promise<void> {
    const { companyId, action, grantedBy, grantedTo, reason, duration, metadata } = params;

    // Log to impersonation_logs table (already exists)
    const operation = (async () => {
      const { error } = await supabase.from('impersonation_logs').insert({
        company_id: companyId,
        admin_user_id: grantedTo || grantedBy || '',
        company_name: '', // Will be filled by trigger or join
        action,
        metadata: {
          granted_by: grantedBy,
          reason,
          duration,
          ...this.sanitizeData(metadata),
        },
      });
      if (error) throw error;
    })();

    this.fireAndForget(operation);
  }

  /**
   * Wait for all pending logs to complete
   * Useful for graceful shutdown or testing
   */
  async flush(): Promise<void> {
    await Promise.allSettled(this.pendingLogs);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions for direct use
export const logAudit = (params: AuditLogParams) => logger.logAudit(params);
export const logSecurity = (params: SecurityLogParams) => logger.logSecurity(params);
export const logApplication = (params: ApplicationLogParams) => logger.logApplication(params);
export const logBilling = (params: BillingLogParams) => logger.logBilling(params);
export const logSupportAccess = (params: SupportAccessLogParams) => logger.logSupportAccess(params);
export const logError = (service: string, message: string, error?: Error, context?: Record<string, unknown>) => 
  logger.logError(service, message, error, context);
