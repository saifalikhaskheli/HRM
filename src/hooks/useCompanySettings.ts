import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface CompanySetting {
  id: string;
  company_id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeIdFormat {
  prefix: string;
  padding: number;
  auto_generate: boolean;
}

export interface NotificationPreferences {
  document_expiry_days: number[];
  send_onboarding_email: boolean;
}

export interface SecuritySettings {
  require_password_change_first_login: boolean;
  password_expiry_days: number | null;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
}

export interface ShiftDefaults {
  default_start_time: string;
  default_end_time: string;
  default_weekly_off: string[];
}

// Fetch all company settings
export function useCompanySettings() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['company-settings', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId);
      
      if (error) throw error;
      return data as CompanySetting[];
    },
    enabled: !!companyId,
  });
}

// Fetch a specific setting by key
export function useCompanySetting<T = Record<string, unknown>>(key: string) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['company-setting', companyId, key],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .eq('key', key)
        .maybeSingle();
      
      if (error) throw error;
      return data ? (data.value as T) : null;
    },
    enabled: !!companyId,
  });
}

// Update or create a company setting
export function useUpdateCompanySetting() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ 
      key, 
      value, 
      description 
    }: { 
      key: string; 
      value: Record<string, unknown>; 
      description?: string;
    }) => {
      if (!companyId) throw new Error('No company context');
      
      // Check if setting exists
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', companyId)
        .eq('key', key)
        .maybeSingle();
      
      if (existing) {
        const { data, error } = await supabase
          .from('company_settings')
          .update({ value: value as Json, description })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            company_id: companyId,
            key,
            value: value as Json,
            description,
          }])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-settings', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-setting', companyId, variables.key] });
      toast.success('Settings updated');
    },
    onError: (error) => {
      toast.error('Failed to update settings: ' + error.message);
    },
  });
}

// Typed helpers for common settings
export function useEmployeeIdFormat() {
  return useCompanySetting<EmployeeIdFormat>('employee_id_format');
}

export function useNotificationPreferences() {
  return useCompanySetting<NotificationPreferences>('notification_preferences');
}

export function useSecuritySettings() {
  return useCompanySetting<SecuritySettings>('security');
}

export function useShiftDefaults() {
  return useCompanySetting<ShiftDefaults>('shift_defaults');
}

// Generate employee number using DB function
export function useGenerateEmployeeNumber() {
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company context');
      
      const { data, error } = await supabase
        .rpc('generate_employee_number', { _company_id: companyId });
      
      if (error) throw error;
      return data as string;
    },
  });
}

// Initialize company settings (for new companies or reset)
export function useInitializeCompanySettings() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company context');
      
      const { error } = await supabase
        .rpc('initialize_company_settings', { _company_id: companyId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings', companyId] });
      toast.success('Settings initialized');
    },
    onError: (error) => {
      toast.error('Failed to initialize settings: ' + error.message);
    },
  });
}
