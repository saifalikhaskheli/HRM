import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { LeaveRequestWithRelations, EmployeeBasic, LeaveTypeBasic } from '@/types/database';

export type LeaveRequest = Tables<'leave_requests'>;
export type LeaveRequestInsert = TablesInsert<'leave_requests'>;
export type LeaveRequestUpdate = TablesUpdate<'leave_requests'>;
export type LeaveType = Tables<'leave_types'>;

export type { LeaveRequestWithRelations };

export function useLeaveTypes() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['leave-types', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useAllLeaveTypes() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['leave-types', 'all', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (leaveType: {
      name: string;
      code: string;
      description?: string;
      color?: string;
      default_days?: number;
      is_paid?: boolean;
      requires_approval?: boolean;
      max_consecutive_days?: number;
      min_notice_days?: number;
    }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('leave_types')
        .insert({ ...leaveType, company_id: companyId })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'leave_types',
        action: 'create' as const,
        record_id: data.id,
        new_values: { name: data.name, code: data.code },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      toast.success('Leave type created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create leave type: ${error.message}`);
    },
  });
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      description?: string;
      color?: string;
      default_days?: number;
      is_paid?: boolean;
      requires_approval?: boolean;
      is_active?: boolean;
      max_consecutive_days?: number;
      min_notice_days?: number;
    }) => {
      const { data, error } = await supabase
        .from('leave_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'leave_types',
        action: 'update' as const,
        record_id: id,
        new_values: updates,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      toast.success('Leave type updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update leave type: ${error.message}`);
    },
  });
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('leave_types')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'leave_types',
        action: 'delete' as const,
        record_id: id,
        metadata: { soft_delete: true },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      toast.success('Leave type removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove leave type: ${error.message}`);
    },
  });
}

export interface BulkImportItem {
  name: string;
  code: string;
  description?: string;
  color?: string;
  default_days?: number;
  is_paid?: boolean;
  requires_approval?: boolean;
  requires_document?: boolean;
  max_consecutive_days?: number;
  min_notice_days?: number;
  accrual_rate?: number;
  carry_over_limit?: number;
}

export function useBulkImportLeaveTypes() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      items, 
      updateExisting 
    }: { 
      items: BulkImportItem[]; 
      updateExisting: boolean;
    }) => {
      if (!companyId) throw new Error('No company selected');

      // Get existing leave types to check for duplicates
      const { data: existing, error: fetchError } = await supabase
        .from('leave_types')
        .select('id, code')
        .eq('company_id', companyId);

      if (fetchError) throw fetchError;

      const existingByCode = new Map(
        (existing || []).map(lt => [lt.code.toLowerCase(), lt.id])
      );

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: Array<{ code: string; message: string }> = [];

      for (const item of items) {
        const existingId = existingByCode.get(item.code.toLowerCase());

        try {
          if (existingId) {
            if (updateExisting) {
              // Update existing
              const { error } = await supabase
                .from('leave_types')
                .update({
                  name: item.name,
                  description: item.description,
                  color: item.color,
                  default_days: item.default_days,
                  is_paid: item.is_paid,
                  requires_approval: item.requires_approval,
                  requires_document: item.requires_document,
                  max_consecutive_days: item.max_consecutive_days,
                  min_notice_days: item.min_notice_days,
                  accrual_rate: item.accrual_rate,
                  carry_over_limit: item.carry_over_limit,
                  is_active: true,
                })
                .eq('id', existingId);

              if (error) throw error;
              updated++;
            } else {
              skipped++;
            }
          } else {
            // Create new
            const { error } = await supabase
              .from('leave_types')
              .insert({
                company_id: companyId,
                name: item.name,
                code: item.code,
                description: item.description,
                color: item.color,
                default_days: item.default_days,
                is_paid: item.is_paid,
                requires_approval: item.requires_approval,
                requires_document: item.requires_document,
                max_consecutive_days: item.max_consecutive_days,
                min_notice_days: item.min_notice_days,
                accrual_rate: item.accrual_rate,
                carry_over_limit: item.carry_over_limit,
              });

            if (error) throw error;
            created++;
          }
        } catch (err) {
          errors.push({
            code: item.code,
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      // Audit log for bulk import
      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'leave_types',
        action: 'create' as const,
        metadata: { 
          bulk_import: true,
          created,
          updated,
          skipped,
          errors: errors.length,
        },
      });

      return { created, updated, skipped, errors };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      const messages: string[] = [];
      if (result.created > 0) messages.push(`${result.created} created`);
      if (result.updated > 0) messages.push(`${result.updated} updated`);
      if (result.skipped > 0) messages.push(`${result.skipped} skipped`);
      toast.success(`Leave types imported: ${messages.join(', ')}`);
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
}

export function useMyLeaveRequests() {
  const { companyId, employeeId } = useTenant();

  return useQuery({
    queryKey: ['leave-requests', 'my', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_type:leave_types(id, name, color),
          reviewed_by_employee:employees!leave_requests_reviewed_by_fkey(id, first_name, last_name)
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useTeamLeaveRequests() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['leave-requests', 'team', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees(id, first_name, last_name, email),
          leave_type:leave_types(id, name, color)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function usePendingLeaveRequests() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['leave-requests', 'pending', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees(id, first_name, last_name, email, department:departments(name)),
          leave_type:leave_types(id, name, color)
        `)
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async (request: Omit<LeaveRequestInsert, 'company_id' | 'employee_id'>) => {
      if (!companyId || !employeeId) throw new Error('Missing context');

      // Check balance before creating request
      const { data: balanceCheck, error: balanceError } = await supabase.rpc('check_leave_balance', {
        _employee_id: employeeId,
        _leave_type_id: request.leave_type_id,
        _days: request.total_days,
      });

      if (balanceError) {
        console.warn('Balance check failed:', balanceError);
        // Continue anyway - balance check is advisory
      } else if (balanceCheck?.[0] && !balanceCheck[0].has_balance) {
        throw new Error(balanceCheck[0].message || 'Insufficient leave balance');
      }

      const { data, error } = await supabase
        .from('leave_requests')
        .insert({ ...request, company_id: companyId, employee_id: employeeId })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'leave_requests',
        action: 'create',
        record_id: data.id,
        new_values: data,
      });

      // Trigger notification (fire and forget)
      supabase.functions.invoke('send-notification', {
        body: {
          type: 'leave_request_submitted',
          record_id: data.id,
          company_id: companyId,
        },
      }).catch(err => console.warn('Notification failed:', err));

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Leave request submitted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit leave request');
    },
  });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, review_notes }: { id: string; review_notes?: string }) => {
      // First get the request to check balance
      const { data: request, error: fetchError } = await supabase
        .from('leave_requests')
        .select('employee_id, leave_type_id, total_days')
        .eq('id', id)
        .single();

      if (fetchError || !request) throw new Error('Leave request not found');

      // Verify balance is sufficient
      const { data: balanceCheck } = await supabase.rpc('check_leave_balance', {
        _employee_id: request.employee_id,
        _leave_type_id: request.leave_type_id,
        _days: request.total_days,
      });

      if (balanceCheck?.[0] && !balanceCheck[0].has_balance) {
        throw new Error(`Cannot approve: ${balanceCheck[0].message}`);
      }

      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          reviewed_by: employeeId,
          reviewed_at: new Date().toISOString(),
          review_notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'leave_requests',
        action: 'update',
        record_id: id,
        new_values: { status: 'approved', review_notes },
        metadata: { action_type: 'approve_leave' },
      });

      // Send notification
      supabase.functions.invoke('send-notification', {
        body: {
          type: 'leave_request_approved',
          record_id: id,
          company_id: companyId,
        },
      }).catch(err => console.warn('Notification failed:', err));

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Leave request approved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve request');
    },
  });
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, review_notes }: { id: string; review_notes?: string }) => {
      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          reviewed_by: employeeId,
          reviewed_at: new Date().toISOString(),
          review_notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'leave_requests',
        action: 'update',
        record_id: id,
        new_values: { status: 'rejected', review_notes },
        metadata: { action_type: 'reject_leave' },
      });

      // Send notification
      supabase.functions.invoke('send-notification', {
        body: {
          type: 'leave_request_rejected',
          record_id: id,
          company_id: companyId,
        },
      }).catch(err => console.warn('Notification failed:', err));

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Leave request rejected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject request');
    },
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('leave_requests')
        .update({ status: 'canceled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'leave_requests',
        action: 'update',
        record_id: id,
        new_values: { status: 'canceled' },
        metadata: { action_type: 'cancel_leave' },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Leave request cancelled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel request');
    },
  });
}
