import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { 
  PayrollRun, 
  PayrollEntry, 
  PayrollRunWithEntries, 
  PayrollEntryWithEmployee 
} from '@/types/payroll';

export type { PayrollRun, PayrollEntry, PayrollRunWithEntries, PayrollEntryWithEmployee };

export function usePayrollRuns() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['payroll-runs', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('company_id', companyId)
        .order('pay_date', { ascending: false });

      if (error) throw error;
      return data as PayrollRun[];
    },
    enabled: !!companyId,
  });
}

export function usePayrollRun(runId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['payroll-run', runId],
    queryFn: async () => {
      if (!runId || !companyId) return null;

      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .eq('company_id', companyId)
        .single();

      if (error) throw error;
      return data as PayrollRun;
    },
    enabled: !!runId && !!companyId,
  });
}

export function usePayrollEntries(runId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['payroll-entries', runId],
    queryFn: async (): Promise<PayrollEntryWithEmployee[]> => {
      if (!runId || !companyId) return [];

      const { data, error } = await supabase
        .from('payroll_entries')
        .select(`
          *,
          employee:employees(id, first_name, last_name, employee_number, job_title)
        `)
        .eq('payroll_run_id', runId)
        .eq('company_id', companyId);

      if (error) throw error;
      return data as PayrollEntryWithEmployee[];
    },
    enabled: !!runId && !!companyId,
  });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      period_start: string;
      period_end: string;
      pay_date: string;
      currency?: string;
      notes?: string;
      autoGenerateSummaries?: boolean;
    }) => {
      if (!companyId) throw new Error('No company selected');

      // Auto-generate attendance summaries if requested
      if (data.autoGenerateSummaries) {
        await supabase.rpc('generate_attendance_summary', {
          _company_id: companyId,
          _period_start: data.period_start,
          _period_end: data.period_end,
        });
      }

      const { data: run, error } = await supabase
        .from('payroll_runs')
        .insert({
          company_id: companyId,
          name: data.name,
          period_start: data.period_start,
          period_end: data.period_end,
          pay_date: data.pay_date,
          currency: data.currency || 'USD',
          notes: data.notes,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return run;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summaries'] });
      toast.success('Payroll run created with attendance data');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddPayrollEntry() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (data: {
      payroll_run_id: string;
      employee_id: string;
      base_salary: number;
      overtime_pay?: number;
      bonuses?: number;
      tax_deductions?: number;
      benefits_deductions?: number;
      pf_deduction?: number;
      days_present?: number;
      days_absent?: number;
      days_late?: number;
      half_days?: number;
      hours_worked?: number;
      overtime_hours?: number;
      total_late_minutes?: number;
      notes?: string;
    }) => {
      if (!companyId) throw new Error('No company selected');

      // Check if run is still editable
      const { data: run } = await supabase
        .from('payroll_runs')
        .select('status')
        .eq('id', data.payroll_run_id)
        .single();

      if (run?.status !== 'draft') {
        throw new Error('Cannot modify a locked payroll run');
      }

      // Check if PF is enabled for the company
      const { data: company } = await supabase
        .from('companies')
        .select('pf_enabled, pf_employee_rate')
        .eq('id', companyId)
        .single();

      // Calculate PF deduction if enabled and not provided
      let pfDeduction = data.pf_deduction || 0;
      if (company?.pf_enabled && !data.pf_deduction) {
        const pfRate = company.pf_employee_rate || 0;
        pfDeduction = (data.base_salary * pfRate) / 100;
      }

      const grossPay = (data.base_salary || 0) + (data.overtime_pay || 0) + (data.bonuses || 0);
      const totalDeductions = (data.tax_deductions || 0) + (data.benefits_deductions || 0) + pfDeduction;
      const netPay = grossPay - totalDeductions;

      const { data: entry, error } = await supabase
        .from('payroll_entries')
        .insert({
          company_id: companyId,
          payroll_run_id: data.payroll_run_id,
          employee_id: data.employee_id,
          base_salary: data.base_salary,
          overtime_pay: data.overtime_pay || 0,
          bonuses: data.bonuses || 0,
          tax_deductions: data.tax_deductions || 0,
          benefits_deductions: data.benefits_deductions || 0,
          pf_deduction: pfDeduction,
          gross_pay: grossPay,
          total_deductions: totalDeductions,
          net_pay: netPay,
          days_present: data.days_present,
          days_absent: data.days_absent,
          days_late: data.days_late,
          half_days: data.half_days,
          hours_worked: data.hours_worked,
          overtime_hours: data.overtime_hours,
          total_late_minutes: data.total_late_minutes,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return entry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-entries', variables.payroll_run_id] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast.success('Payroll entry added');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdatePayrollEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      payroll_run_id,
      ...updates 
    }: Partial<PayrollEntry> & { id: string; payroll_run_id: string }) => {
      // Check if run is still editable
      const { data: run } = await supabase
        .from('payroll_runs')
        .select('status')
        .eq('id', payroll_run_id)
        .single();

      if (run?.status !== 'draft') {
        throw new Error('Cannot modify a locked payroll run');
      }

      // Recalculate totals if salary components changed
      if (updates.base_salary !== undefined || updates.overtime_pay !== undefined || 
          updates.bonuses !== undefined || updates.tax_deductions !== undefined ||
          updates.benefits_deductions !== undefined) {
        const grossPay = (updates.base_salary || 0) + (updates.overtime_pay || 0) + (updates.bonuses || 0);
        const totalDeductions = (updates.tax_deductions || 0) + (updates.benefits_deductions || 0);
        updates.gross_pay = grossPay;
        updates.total_deductions = totalDeductions;
        updates.net_pay = grossPay - totalDeductions;
      }

      const { data, error } = await supabase
        .from('payroll_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-entries', variables.payroll_run_id] });
      toast.success('Entry updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useLockPayrollRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runId, action }: { runId: string; action: 'process' | 'complete' }) => {
      const { data: run, error: fetchError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (fetchError) throw fetchError;

      // Validate state transition
      if (action === 'process' && run.status !== 'draft') {
        throw new Error('Can only process draft payroll runs');
      }
      if (action === 'complete' && run.status !== 'processing') {
        throw new Error('Can only complete processing payroll runs');
      }

      // Lock attendance summaries when completing
      if (action === 'complete') {
        await supabase.rpc('lock_attendance_for_payroll', {
          _payroll_run_id: runId,
        });
      }

      // Calculate totals from entries
      const { data: entries } = await supabase
        .from('payroll_entries')
        .select('gross_pay, net_pay, total_deductions, total_employer_cost')
        .eq('payroll_run_id', runId);

      const totals = entries?.reduce(
        (acc, e) => ({
          total_gross: acc.total_gross + Number(e.gross_pay || 0),
          total_net: acc.total_net + Number(e.net_pay || 0),
          total_deductions: acc.total_deductions + Number(e.total_deductions || 0),
          total_employer_cost: acc.total_employer_cost + Number(e.total_employer_cost || 0),
        }),
        { total_gross: 0, total_net: 0, total_deductions: 0, total_employer_cost: 0 }
      ) || { total_gross: 0, total_net: 0, total_deductions: 0, total_employer_cost: 0 };

      const newStatus = action === 'process' ? 'processing' : 'completed';
      const updateData: Partial<PayrollRun> = {
        status: newStatus,
        employee_count: entries?.length || 0,
        ...totals,
      };

      if (action === 'complete') {
        updateData.processed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('payroll_runs')
        .update(updateData)
        .eq('id', runId)
        .select()
        .single();

      if (error) throw error;

      // Send notifications on payroll completion
      if (action === 'complete') {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'payroll_processed',
              companyId: run.company_id,
              data: {
                payrollRunId: runId,
                payrollName: run.name,
                payDate: run.pay_date,
              },
            },
          });
        } catch (e) {
          console.error('Failed to send payroll notification:', e);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run', data.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summaries'] });
      toast.success(data.status === 'completed' ? 'Payroll run completed and locked' : 'Payroll run submitted for processing');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeletePayrollRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from('payroll_runs')
        .delete()
        .eq('id', runId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast.success('Payroll run deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Summary stats for dashboard
export function usePayrollStats() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['payroll-stats', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data: runs, error } = await supabase
        .from('payroll_runs')
        .select('id, status, total_net, total_gross, pay_date')
        .eq('company_id', companyId)
        .order('pay_date', { ascending: false })
        .limit(12);

      if (error) throw error;

      const completed = runs?.filter(r => r.status === 'completed') || [];
      const lastRun = completed[0];
      const totalPaidThisYear = completed
        .filter(r => r.pay_date?.startsWith(new Date().getFullYear().toString()))
        .reduce((sum, r) => sum + Number(r.total_net || 0), 0);

      return {
        totalRuns: runs?.length || 0,
        completedRuns: completed.length,
        pendingRuns: runs?.filter(r => r.status === 'draft' || r.status === 'processing').length || 0,
        lastPayDate: lastRun?.pay_date,
        lastPayrollTotal: lastRun?.total_net,
        totalPaidThisYear,
      };
    },
    enabled: !!companyId,
  });
}
