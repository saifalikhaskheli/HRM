import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { Tables } from '@/integrations/supabase/types';

export type CompanyUser = Tables<'company_users'> & {
  profile: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function useCompanyUsers() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['company-users', companyId],
    queryFn: async (): Promise<CompanyUser[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately since there's no FK relationship
      const userIds = (data || []).map(u => u.user_id);
      let profiles: Record<string, { email: string; first_name: string | null; last_name: string | null; avatar_url: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, avatar_url')
          .in('id', userIds);
        
        if (profileData) {
          profiles = profileData.reduce((acc, p) => {
            acc[p.id] = { email: p.email, first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url };
            return acc;
          }, {} as typeof profiles);
        }
      }

      // Map the profile field from separate query
      return (data || []).map(user => ({
        ...user,
        profile: profiles[user.user_id] || null,
      })) as CompanyUser[];
    },
    enabled: !!companyId,
    retry: 2,
    staleTime: 30000,
  });
}
