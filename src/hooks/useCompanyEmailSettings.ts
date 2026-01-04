import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface CompanyEmailSettings {
  id: string;
  company_id: string;
  use_platform_default: boolean;
  provider: string | null;
  from_email: string | null;
  from_name: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_secure: boolean | null;
  api_key: string | null;
  aws_region: string | null;
  aws_access_key_id: string | null;
  aws_secret_access_key: string | null;
  is_verified: boolean;
  verified_at: string | null;
  last_test_at: string | null;
  last_test_result: {
    success: boolean;
    error?: string;
    provider?: string;
    tested_to?: string;
  } | null;
}

export interface EmailSettingsFormData {
  use_platform_default: boolean;
  provider: string;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_secure: boolean;
  api_key: string;
  aws_region: string;
  aws_access_key_id: string;
  aws_secret_access_key: string;
}

export type EmailProvider = 'smtp' | 'resend' | 'mailersend' | 'sendgrid' | 'brevo' | 'ses';

// Helper to invoke edge function with session refresh on 401
async function invokeWithRetry<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  // Ensure we have a fresh session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Force sign out and throw
    await supabase.auth.signOut();
    throw new Error('Session expired. Please log in again.');
  }

  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    const errorMessage = error.message || '';
    // Check for auth-related errors
    if (errorMessage.includes('401') || errorMessage.includes('JWT') || errorMessage.includes('Invalid') || errorMessage.includes('Unauthorized')) {
      // Try to refresh the session
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        // Force sign out and throw
        await supabase.auth.signOut();
        throw new Error('Session expired. Please log in again.');
      }
      // Retry the request
      const { data: retryData, error: retryError } = await supabase.functions.invoke(functionName, { body });
      if (retryError) {
        // If still auth error after refresh, sign out
        const retryMsg = retryError.message || '';
        if (retryMsg.includes('401') || retryMsg.includes('JWT') || retryMsg.includes('Invalid') || retryMsg.includes('Unauthorized')) {
          await supabase.auth.signOut();
          throw new Error('Session expired. Please log in again.');
        }
        throw retryError;
      }
      return retryData as T;
    }
    throw error;
  }
  return data as T;
}

export function useCompanyEmailSettings() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['company-email-settings', companyId],
    queryFn: async (): Promise<CompanyEmailSettings | null> => {
      if (!companyId) return null;

      const data = await invokeWithRetry<{ settings: CompanyEmailSettings | null }>(
        'manage-email-settings',
        { action: 'get', company_id: companyId }
      );
      return data?.settings || null;
    },
    enabled: !!companyId,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (formData: EmailSettingsFormData) => {
      if (!companyId) throw new Error('No company selected');

      return invokeWithRetry('manage-email-settings', {
        company_id: companyId,
        ...formData,
      });
    },
    onSuccess: () => {
      toast.success('Email settings saved');
      queryClient.invalidateQueries({ queryKey: ['company-email-settings', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save settings');
    },
  });

  const deleteSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected');

      return invokeWithRetry('manage-email-settings', {
        action: 'delete',
        company_id: companyId,
      });
    },
    onSuccess: () => {
      toast.success('Custom settings removed, using platform default');
      queryClient.invalidateQueries({ queryKey: ['company-email-settings', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete settings');
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (toEmail: string) => {
      if (!companyId) throw new Error('No company selected');

      const data = await invokeWithRetry<{ success: boolean; error?: string; message?: string }>(
        'test-company-email',
        { company_id: companyId, to: toEmail }
      );
      if (!data.success) throw new Error(data.error || 'Test email failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Test email sent successfully');
      queryClient.invalidateQueries({ queryKey: ['company-email-settings', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send test email');
    },
  });

  return {
    settings,
    isLoading,
    error,
    saveSettings: saveSettingsMutation.mutate,
    isSaving: saveSettingsMutation.isPending,
    deleteSettings: deleteSettingsMutation.mutate,
    isDeleting: deleteSettingsMutation.isPending,
    sendTestEmail: testEmailMutation.mutate,
    isTesting: testEmailMutation.isPending,
  };
}
