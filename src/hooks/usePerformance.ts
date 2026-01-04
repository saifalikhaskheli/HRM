import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, Enums } from '@/integrations/supabase/types';

export type PerformanceReview = Tables<'performance_reviews'>;
export type ReviewStatus = Enums<'review_status'>;

// My reviews (as employee)
export function useMyReviews() {
  const { employeeId } = useTenant();

  return useQuery({
    queryKey: ['performance-reviews', 'my', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from('performance_reviews')
        .select(`
          *,
          reviewer:employees!performance_reviews_reviewer_id_fkey(id, first_name, last_name)
        `)
        .eq('employee_id', employeeId)
        .in('status', ['completed', 'acknowledged'])
        .order('review_period_end', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });
}

// Reviews I need to complete (as manager/reviewer)
export function usePendingReviews() {
  const { employeeId } = useTenant();

  return useQuery({
    queryKey: ['performance-reviews', 'pending', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from('performance_reviews')
        .select(`
          *,
          employee:employees!performance_reviews_employee_id_fkey(id, first_name, last_name, job_title, department:departments(name))
        `)
        .eq('reviewer_id', employeeId)
        .in('status', ['draft', 'in_progress'])
        .order('review_period_end', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });
}

// All reviews (HR view)
export function useAllReviews(status?: ReviewStatus) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['performance-reviews', 'all', companyId, status],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('performance_reviews')
        .select(`
          *,
          employee:employees!performance_reviews_employee_id_fkey(id, first_name, last_name, job_title),
          reviewer:employees!performance_reviews_reviewer_id_fkey(id, first_name, last_name)
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

export function useReview(id: string | null) {
  return useQuery({
    queryKey: ['performance-reviews', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('performance_reviews')
        .select(`
          *,
          employee:employees!performance_reviews_employee_id_fkey(id, first_name, last_name, job_title, email, department:departments(name)),
          reviewer:employees!performance_reviews_reviewer_id_fkey(id, first_name, last_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (review: Omit<TablesInsert<'performance_reviews'>, 'company_id'>) => {
      if (!companyId) throw new Error('No company selected');

      const { data, error } = await supabase
        .from('performance_reviews')
        .insert({ ...review, company_id: companyId })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'performance_reviews',
        action: 'create',
        record_id: data.id,
        new_values: { employee_id: review.employee_id, reviewer_id: review.reviewer_id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      toast.success('Performance review created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create review');
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<PerformanceReview>) => {
      const { data, error } = await supabase
        .from('performance_reviews')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'performance_reviews',
        action: 'update',
        record_id: id,
        new_values: updates,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      toast.success('Review updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update review');
    },
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, ...reviewData }: { id: string; overall_rating: number; manager_assessment: string; strengths?: string; areas_for_improvement?: string; development_plan?: string }) => {
      const { data, error } = await supabase
        .from('performance_reviews')
        .update({
          ...reviewData,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'performance_reviews',
        action: 'update',
        record_id: id,
        new_values: { status: 'completed' },
        metadata: { action_type: 'submit_review' },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      toast.success('Review submitted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit review');
    },
  });
}

export function useAcknowledgeReview() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, employee_comments }: { id: string; employee_comments?: string }) => {
      const { data, error } = await supabase
        .from('performance_reviews')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          employee_comments,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      toast.success('Review acknowledged');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to acknowledge review');
    },
  });
}

// Review stats
export function useReviewStats() {
  const { data: allReviews = [] } = useAllReviews();

  return {
    total: allReviews.length,
    draft: allReviews.filter(r => r.status === 'draft').length,
    inProgress: allReviews.filter(r => r.status === 'in_progress').length,
    completed: allReviews.filter(r => r.status === 'completed').length,
    acknowledged: allReviews.filter(r => r.status === 'acknowledged').length,
    averageRating: allReviews.filter(r => r.overall_rating).reduce((sum, r) => sum + (r.overall_rating || 0), 0) / (allReviews.filter(r => r.overall_rating).length || 1),
  };
}
