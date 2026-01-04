import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, Enums } from '@/integrations/supabase/types';

export type Job = Tables<'jobs'>;
export type Candidate = Tables<'candidates'>;
export type JobStatus = Enums<'job_status'>;
export type CandidateStatus = Enums<'candidate_status'>;

// Jobs
export function useJobs(status?: JobStatus) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['jobs', companyId, status],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('jobs')
        .select(`
          *,
          department:departments(id, name),
          hiring_manager:employees!jobs_hiring_manager_id_fkey(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useJob(id: string | null) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          department:departments(id, name),
          hiring_manager:employees!jobs_hiring_manager_id_fkey(id, first_name, last_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (job: Omit<TablesInsert<'jobs'>, 'company_id'>) => {
      if (!companyId) throw new Error('No company selected');

      const { data, error } = await supabase
        .from('jobs')
        .insert({ ...job, company_id: companyId })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'jobs',
        action: 'create',
        record_id: data.id,
        new_values: { title: job.title, status: job.status },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job posting created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create job posting');
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Job>) => {
      const { data, error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'jobs',
        action: 'update',
        record_id: id,
        new_values: updates,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job posting updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update job posting');
    },
  });
}

// Candidates
export function useCandidates(jobId?: string, status?: CandidateStatus) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['candidates', companyId, jobId, status],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('candidates')
        .select(`
          *,
          job:jobs(id, title, slug)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (jobId) query = query.eq('job_id', jobId);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCandidate(id: string | null) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['candidates', id, companyId],
    queryFn: async () => {
      if (!id || !companyId) return null;

      const { data, error } = await supabase
        .from('candidates')
        .select(`
          *,
          job:jobs(id, title, slug, department:departments(id, name))
        `)
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

      if (error) {
        console.error('Error fetching candidate:', error);
        return null;
      }
      return data;
    },
    enabled: !!id && !!companyId,
  });
}

export function useUpdateCandidateStatus() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      rejected_reason 
    }: { 
      id: string; 
      status: CandidateStatus;
      rejected_reason?: string;
    }) => {
      const updates: Partial<Candidate> = { status };
      if (status === 'rejected' && rejected_reason) {
        updates.rejected_reason = rejected_reason;
      }

      const { data, error } = await supabase
        .from('candidates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'candidates',
        action: 'update',
        record_id: id,
        new_values: updates,
        metadata: { action_type: 'status_change' },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate status updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update candidate status');
    },
  });
}

// Pipeline stats
export function usePipelineStats(jobId?: string) {
  const { data: candidates = [] } = useCandidates(jobId);

  const stats = {
    applied: candidates.filter(c => c.status === 'applied').length,
    screening: candidates.filter(c => c.status === 'screening').length,
    interviewing: candidates.filter(c => c.status === 'interviewing').length,
    offered: candidates.filter(c => c.status === 'offered').length,
    hired: candidates.filter(c => c.status === 'hired').length,
    rejected: candidates.filter(c => c.status === 'rejected').length,
    withdrawn: candidates.filter(c => c.status === 'withdrawn').length,
    total: candidates.length,
  };

  return stats;
}
