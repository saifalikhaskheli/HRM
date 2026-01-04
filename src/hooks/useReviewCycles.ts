import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface ReviewCycle {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  cycle_type: string;
  start_date: string;
  end_date: string;
  review_period_start: string;
  review_period_end: string;
  reminder_days: number[];
  escalation_days: number;
  auto_create_reviews: boolean;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useReviewCycles() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['review-cycles', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('review_cycles')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ReviewCycle[];
    },
    enabled: !!companyId,
  });
}

export function useCreateReviewCycle() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (cycle: Omit<ReviewCycle, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
      if (!companyId) throw new Error('No company selected');

      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('review_cycles')
        .insert({
          ...cycle,
          company_id: companyId,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ReviewCycle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
      toast.success('Review cycle created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create review cycle');
    },
  });
}

export function useActivateReviewCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cycleId: string) => {
      // Update cycle status to active
      const { error: updateError } = await supabase
        .from('review_cycles')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', cycleId);

      if (updateError) throw updateError;

      // Auto-create reviews if enabled
      const { data: cycle } = await supabase
        .from('review_cycles')
        .select('auto_create_reviews')
        .eq('id', cycleId)
        .single();

      if (cycle?.auto_create_reviews) {
        const { data: count, error: rpcError } = await supabase
          .rpc('create_reviews_for_cycle', { _cycle_id: cycleId });

        if (rpcError) throw rpcError;
        return { cycleId, reviewsCreated: count };
      }

      return { cycleId, reviewsCreated: 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      toast.success(`Review cycle activated${result.reviewsCreated ? `. Created ${result.reviewsCreated} reviews.` : ''}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to activate review cycle');
    },
  });
}

export function useReviewReminders() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['review-reminders', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('review_reminders')
        .select(`
          *,
          review:performance_reviews(
            id,
            employee:employees!performance_reviews_employee_id_fkey(first_name, last_name),
            reviewer:employees!performance_reviews_reviewer_id_fkey(first_name, last_name)
          )
        `)
        .eq('company_id', companyId)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

// Manual trigger for performance reminders cron (for admins)
export function useTriggerPerformanceReminders() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cron-performance-reminders');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sent ${data.remindersSent} reminders, ${data.escalationsSent} escalations`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send reminders');
    },
  });
}
