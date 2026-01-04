import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Job = Database['public']['Tables']['jobs']['Row'];
type CandidateInsert = Database['public']['Tables']['candidates']['Insert'];

interface JobWithDepartment extends Job {
  department: { id: string; name: string } | null;
}

export function usePublicJobs(companyId: string | null) {
  return useQuery({
    queryKey: ['public-jobs', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          department:departments(id, name)
        `)
        .eq('company_id', companyId)
        .eq('status', 'open')
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data as JobWithDepartment[];
    },
    enabled: !!companyId,
  });
}

export function usePublicJob(companyId: string | null, jobSlug: string | null) {
  return useQuery({
    queryKey: ['public-job', companyId, jobSlug],
    queryFn: async () => {
      if (!companyId || !jobSlug) return null;
      
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          department:departments(id, name)
        `)
        .eq('company_id', companyId)
        .eq('slug', jobSlug)
        .eq('status', 'open')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data as JobWithDepartment;
    },
    enabled: !!companyId && !!jobSlug,
  });
}

export function useSubmitApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (application: CandidateInsert) => {
      const { data, error } = await supabase
        .from('candidates')
        .insert(application)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-jobs'] });
    },
  });
}
