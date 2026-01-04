import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface TimeCorrectionRequest {
  id: string;
  company_id: string;
  employee_id: string;
  original_entry_id: string | null;
  correction_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  requested_break_minutes: number;
  reason: string;
  supporting_document_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'clarification_needed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
  };
  reviewer?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Fetch my correction requests
export function useMyTimeCorrectionRequests() {
  const { companyId, employeeId } = useTenant();

  return useQuery({
    queryKey: ['time-correction-requests', 'my', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('time_correction_requests')
        .select(`
          *,
          reviewer:employees!time_correction_requests_reviewed_by_fkey(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TimeCorrectionRequest[];
    },
    enabled: !!companyId && !!employeeId,
  });
}

// Fetch all pending correction requests (for HR)
export function usePendingTimeCorrectionRequests() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['time-correction-requests', 'pending', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('time_correction_requests')
        .select(`
          *,
          employee:employees!time_correction_requests_employee_id_fkey(id, first_name, last_name, employee_number)
        `)
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TimeCorrectionRequest[];
    },
    enabled: !!companyId,
  });
}

// Fetch all correction requests (for HR)
export function useAllTimeCorrectionRequests(status?: string) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['time-correction-requests', 'all', companyId, status],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('time_correction_requests')
        .select(`
          *,
          employee:employees!time_correction_requests_employee_id_fkey(id, first_name, last_name, employee_number),
          reviewer:employees!time_correction_requests_reviewed_by_fkey(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TimeCorrectionRequest[];
    },
    enabled: !!companyId,
  });
}

// Create a new correction request
export function useCreateTimeCorrectionRequest() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async (request: {
      correction_date: string;
      requested_clock_in: string | null;
      requested_clock_out: string | null;
      requested_break_minutes?: number;
      reason: string;
      supporting_document_url?: string;
    }) => {
      if (!companyId || !employeeId) throw new Error('Missing context');

      // Check if there's an existing time entry for this date
      const { data: existingEntry } = await supabase
        .from('time_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .eq('date', request.correction_date)
        .maybeSingle();

      const { data, error } = await supabase
        .from('time_correction_requests')
        .insert({
          company_id: companyId,
          employee_id: employeeId,
          original_entry_id: existingEntry?.id || null,
          correction_date: request.correction_date,
          requested_clock_in: request.requested_clock_in,
          requested_clock_out: request.requested_clock_out,
          requested_break_minutes: request.requested_break_minutes || 0,
          reason: request.reason,
          supporting_document_url: request.supporting_document_url,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Add audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'time_correction_requests',
        action: 'create' as const,
        record_id: data.id,
        new_values: { id: data.id, correction_date: data.correction_date },
        metadata: { action_type: 'time_correction_request' },
      }]);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-correction-requests'] });
      toast.success('Time correction request submitted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit correction request');
    },
  });
}

// Approve a correction request
export function useApproveTimeCorrectionRequest() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, review_notes }: { id: string; review_notes?: string }) => {
      if (!companyId || !employeeId) throw new Error('Missing context');

      // Get the correction request
      const { data: request, error: fetchError } = await supabase
        .from('time_correction_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Update the correction request status
      const { error: updateError } = await supabase
        .from('time_correction_requests')
        .update({
          status: 'approved',
          reviewed_by: employeeId,
          reviewed_at: new Date().toISOString(),
          review_notes,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Apply the correction to the time entry
      if (request.original_entry_id) {
        // Get original entry to preserve values
        const { data: originalEntry } = await supabase
          .from('time_entries')
          .select('*')
          .eq('id', request.original_entry_id)
          .single();

        if (originalEntry) {
          // Calculate total hours
          let totalHours = 0;
          if (request.requested_clock_in && request.requested_clock_out) {
            const clockIn = new Date(request.requested_clock_in);
            const clockOut = new Date(request.requested_clock_out);
            const diffMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
            totalHours = Math.max(0, (diffMinutes - (request.requested_break_minutes || 0)) / 60);
          }

          // Update with original values preserved
          await supabase
            .from('time_entries')
            .update({
              clock_in: request.requested_clock_in,
              clock_out: request.requested_clock_out,
              break_minutes: request.requested_break_minutes,
              total_hours: Math.round(totalHours * 100) / 100,
              is_corrected: true,
              correction_id: id,
              original_clock_in: originalEntry.original_clock_in || originalEntry.clock_in,
              original_clock_out: originalEntry.original_clock_out || originalEntry.clock_out,
              corrected_by: employeeId,
              corrected_at: new Date().toISOString(),
              correction_reason: request.reason,
            })
            .eq('id', request.original_entry_id);
        }
      } else {
        // Create a new time entry
        let totalHours = 0;
        if (request.requested_clock_in && request.requested_clock_out) {
          const clockIn = new Date(request.requested_clock_in);
          const clockOut = new Date(request.requested_clock_out);
          const diffMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
          totalHours = Math.max(0, (diffMinutes - (request.requested_break_minutes || 0)) / 60);
        }

        await supabase
          .from('time_entries')
          .insert({
            company_id: request.company_id,
            employee_id: request.employee_id,
            date: request.correction_date,
            clock_in: request.requested_clock_in,
            clock_out: request.requested_clock_out,
            break_minutes: request.requested_break_minutes,
            total_hours: Math.round(totalHours * 100) / 100,
            is_corrected: true,
            correction_id: id,
            corrected_by: employeeId,
            corrected_at: new Date().toISOString(),
            correction_reason: request.reason,
          });
      }

      // Add audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'time_correction_requests',
        action: 'update' as const,
        record_id: id,
        new_values: { status: 'approved', review_notes },
        metadata: { action_type: 'approve_time_correction' },
      }]);

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-correction-requests'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Time correction approved and applied');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve correction');
    },
  });
}

// Reject a correction request
export function useRejectTimeCorrectionRequest() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, review_notes }: { id: string; review_notes: string }) => {
      if (!employeeId) throw new Error('Missing context');

      const { error } = await supabase
        .from('time_correction_requests')
        .update({
          status: 'rejected',
          reviewed_by: employeeId,
          reviewed_at: new Date().toISOString(),
          review_notes,
        })
        .eq('id', id);

      if (error) throw error;

      // Add audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'time_correction_requests',
        action: 'update' as const,
        record_id: id,
        new_values: { status: 'rejected', review_notes },
        metadata: { action_type: 'reject_time_correction' },
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-correction-requests'] });
      toast.success('Time correction rejected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject correction');
    },
  });
}

// Request clarification
export function useRequestClarification() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, review_notes }: { id: string; review_notes: string }) => {
      if (!employeeId) throw new Error('Missing context');

      const { error } = await supabase
        .from('time_correction_requests')
        .update({
          status: 'clarification_needed',
          reviewed_by: employeeId,
          reviewed_at: new Date().toISOString(),
          review_notes,
        })
        .eq('id', id);

      if (error) throw error;

      // Add audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'time_correction_requests',
        action: 'update' as const,
        record_id: id,
        new_values: { status: 'clarification_needed', review_notes },
        metadata: { action_type: 'request_clarification_time_correction' },
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-correction-requests'] });
      toast.success('Clarification requested');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to request clarification');
    },
  });
}
