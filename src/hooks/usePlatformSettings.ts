import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RegistrationSettings {
  open_registration: boolean;
  require_invite: boolean;
  allowed_domains: string[];
}

export function usePlatformSettings() {
  const { data: registrationSettings, isLoading } = useQuery({
    queryKey: ['platform-registration-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_registration_settings');
      if (error) {
        console.error('Error fetching registration settings:', error);
        // Return restrictive defaults if fetch fails
        return {
          open_registration: false,
          require_invite: true,
          allowed_domains: [],
        } as RegistrationSettings;
      }
      // Parse the JSON response
      const settings = data as unknown as RegistrationSettings;
      return {
        open_registration: settings?.open_registration ?? false,
        require_invite: settings?.require_invite ?? true,
        allowed_domains: settings?.allowed_domains ?? [],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    registrationSettings: registrationSettings ?? {
      open_registration: false,
      require_invite: true,
      allowed_domains: [],
    },
    isSignupEnabled: registrationSettings?.open_registration ?? false,
    isLoading,
  };
}

export function useCompanyCreationLinks() {
  return useQuery({
    queryKey: ['company-creation-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_creation_links')
        .select(`
          *,
          plans:plan_id (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useOnboardingLogs() {
  return useQuery({
    queryKey: ['onboarding-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });
}
