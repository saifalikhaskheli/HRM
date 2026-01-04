import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface CandidateAuthConfig {
  id: string;
  company_id: string;
  auth_enabled: boolean;
  require_login_to_apply: boolean;
  magic_link_enabled: boolean;
  social_login_enabled: boolean;
  google_enabled: boolean;
  linkedin_enabled: boolean;
  auth_methods: string[];
  created_at: string;
  updated_at: string;
}

export function useCandidateAuthConfig() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['candidate-auth-config', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('candidate_auth_config')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Return defaults if no config exists
      if (!data) {
        return {
          company_id: companyId,
          auth_enabled: false,
          require_login_to_apply: false,
          magic_link_enabled: true,
          social_login_enabled: false,
          google_enabled: false,
          linkedin_enabled: false,
          auth_methods: ['email', 'magic_link'],
        } as CandidateAuthConfig;
      }

      return data as CandidateAuthConfig;
    },
    enabled: !!companyId,
  });
}

export function useUpdateCandidateAuthConfig() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (config: Partial<CandidateAuthConfig>) => {
      if (!companyId) throw new Error('No company selected');

      // Check if config exists
      const { data: existing } = await supabase
        .from('candidate_auth_config')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('candidate_auth_config')
          .update({
            ...config,
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('candidate_auth_config')
          .insert({
            company_id: companyId,
            ...config,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-auth-config'] });
      toast.success('Candidate auth settings updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update settings');
    },
  });
}

// Hook to check if candidate login is required for a specific company
export function usePublicCandidateAuthConfig(companyId: string | null) {
  return useQuery({
    queryKey: ['public-candidate-auth-config', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('candidate_auth_config')
        .select('auth_enabled, require_login_to_apply, magic_link_enabled, social_login_enabled, google_enabled, linkedin_enabled')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Defaults - no login required
      if (!data) {
        return {
          auth_enabled: false,
          require_login_to_apply: false,
          magic_link_enabled: true,
          social_login_enabled: false,
          google_enabled: false,
          linkedin_enabled: false,
        };
      }

      return data;
    },
    enabled: !!companyId,
  });
}

// Hook to get current candidate user profile
export function useCandidateUser() {
  return useQuery({
    queryKey: ['candidate-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('candidate_users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });
}

// Hook to get candidate's applications
export function useMyCandidateApplications() {
  const { data: candidateUser } = useCandidateUser();

  return useQuery({
    queryKey: ['my-candidate-applications', candidateUser?.id],
    queryFn: async () => {
      if (!candidateUser) return [];

      const { data, error } = await supabase
        .from('candidates')
        .select(`
          *,
          job:jobs(id, title, slug, company:companies(id, name, logo_url))
        `)
        .eq('candidate_user_id', candidateUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!candidateUser?.id,
  });
}
