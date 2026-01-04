import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';

type SecurityEventType = Database['public']['Enums']['security_event_type'];

interface LogEventParams {
  eventType: SecurityEventType;
  description?: string;
  companyId?: string | null;
  metadata?: Record<string, unknown>;
}

export function useSecurityLogger() {
  const { user, currentCompanyId } = useAuth();

  const logEvent = useCallback(async ({
    eventType,
    description,
    companyId,
    metadata = {},
  }: LogEventParams) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        console.warn('Cannot log security event: no authenticated user');
        return;
      }

      const { error } = await supabase.from('security_events').insert({
        event_type: eventType,
        user_id: authUser.id,
        company_id: companyId ?? currentCompanyId ?? null,
        description,
        user_agent: navigator.userAgent,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        },
      });

      if (error) {
        console.error('Failed to log security event:', error);
      }
    } catch (err) {
      console.error('Error logging security event:', err);
    }
  }, [currentCompanyId]);

  const logLoginSuccess = useCallback((metadata?: Record<string, unknown>) => {
    return logEvent({
      eventType: 'login_success',
      description: 'User logged in successfully',
      metadata,
    });
  }, [logEvent]);

  const logLoginFailure = useCallback((email: string, reason?: string) => {
    // Note: This needs to be called without auth, so we handle it differently
    console.log('Login failure:', { email, reason });
  }, []);

  const logLogout = useCallback((reason: 'manual' | 'session_timeout' | 'forced' = 'manual') => {
    return logEvent({
      eventType: 'login_success', // Using login_success as logout event type isn't in enum
      description: `User logged out: ${reason}`,
      metadata: { logout_reason: reason, action: 'logout' },
    });
  }, [logEvent]);

  const logPasswordChange = useCallback(() => {
    return logEvent({
      eventType: 'password_change',
      description: 'User changed their password',
    });
  }, [logEvent]);

  const logMFAEnabled = useCallback(() => {
    return logEvent({
      eventType: 'mfa_enabled',
      description: 'User enabled multi-factor authentication',
    });
  }, [logEvent]);

  const logMFADisabled = useCallback(() => {
    return logEvent({
      eventType: 'mfa_disabled',
      description: 'User disabled multi-factor authentication',
    });
  }, [logEvent]);

  const logSuspiciousActivity = useCallback((description: string, metadata?: Record<string, unknown>) => {
    return logEvent({
      eventType: 'suspicious_activity',
      description,
      metadata,
    });
  }, [logEvent]);

  const logPermissionDenied = useCallback((resource: string, action: string) => {
    return logEvent({
      eventType: 'permission_denied',
      description: `Access denied to ${resource}`,
      metadata: { resource, action },
    });
  }, [logEvent]);

  const logDataExport = useCallback((exportType: string, recordCount?: number) => {
    return logEvent({
      eventType: 'data_export',
      description: `Data exported: ${exportType}`,
      metadata: { export_type: exportType, record_count: recordCount },
    });
  }, [logEvent]);

  return {
    logEvent,
    logLoginSuccess,
    logLoginFailure,
    logLogout,
    logPasswordChange,
    logMFAEnabled,
    logMFADisabled,
    logSuspiciousActivity,
    logPermissionDenied,
    logDataExport,
  };
}
