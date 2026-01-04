import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

export type AttendanceSummary = Tables<'attendance_summaries'>;

// Fetch attendance summaries for a period
export function useAttendanceSummaries(periodStart?: string, periodEnd?: string) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['attendance-summaries', companyId, periodStart, periodEnd],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('attendance_summaries')
        .select(`
          *,
          employee:employees!attendance_summaries_employee_id_fkey(id, first_name, last_name, employee_number, salary)
        `)
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });

      if (periodStart) query = query.gte('period_start', periodStart);
      if (periodEnd) query = query.lte('period_end', periodEnd);

      const { data, error } = await query.limit(500);

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

// Fetch summary for specific employee and period
export function useEmployeeAttendanceSummary(employeeId: string | null, periodStart?: string, periodEnd?: string) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['attendance-summary', employeeId, periodStart, periodEnd],
    queryFn: async () => {
      if (!companyId || !employeeId || !periodStart || !periodEnd) return null;

      const { data, error } = await supabase
        .from('attendance_summaries')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!employeeId && !!periodStart && !!periodEnd,
  });
}

// Generate attendance summaries for a period
export function useGenerateAttendanceSummary() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) => {
      if (!companyId) throw new Error('No company selected');

      const { data, error } = await supabase.rpc('generate_attendance_summary', {
        _company_id: companyId,
        _period_start: periodStart,
        _period_end: periodEnd,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      toast.success(`Generated attendance summaries for ${variables.periodStart} to ${variables.periodEnd}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate summaries: ${error.message}`);
    },
  });
}

// Calculate payroll from attendance
export function useCalculatePayrollFromAttendance() {
  return useMutation({
    mutationFn: async ({ 
      employeeId, 
      periodStart, 
      periodEnd 
    }: { 
      employeeId: string; 
      periodStart: string; 
      periodEnd: string;
    }) => {
      const { data, error } = await supabase.rpc('calculate_payroll_from_attendance', {
        _employee_id: employeeId,
        _period_start: periodStart,
        _period_end: periodEnd,
      });

      if (error) throw error;
      return data?.[0] || null;
    },
  });
}

// Lock attendance summaries for payroll
export function useLockAttendanceForPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payrollRunId: string) => {
      const { data, error } = await supabase.rpc('lock_attendance_for_payroll', {
        _payroll_run_id: payrollRunId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-summaries'] });
      toast.success(`Locked ${count} attendance records`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to lock attendance: ${error.message}`);
    },
  });
}

// Get summaries for a payroll run
export function usePayrollAttendanceSummaries(payrollRunId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['payroll-attendance-summaries', payrollRunId],
    queryFn: async () => {
      if (!companyId || !payrollRunId) return [];

      // First get the payroll run to find the period
      const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .select('period_start, period_end')
        .eq('id', payrollRunId)
        .single();

      if (runError) throw runError;

      // Then get summaries for that period
      const { data, error } = await supabase
        .from('attendance_summaries')
        .select(`
          *,
          employee:employees!attendance_summaries_employee_id_fkey(id, first_name, last_name, employee_number, salary)
        `)
        .eq('company_id', companyId)
        .eq('period_start', run.period_start)
        .eq('period_end', run.period_end);

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!payrollRunId,
  });
}
