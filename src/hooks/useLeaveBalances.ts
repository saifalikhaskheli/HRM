import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  color: string | null;
  year: number;
  allocated: number;
  used: number;
  pending: number;
  carriedOver: number;
  adjustments: number;
  remaining: number;
}

export interface EmployeeLeaveBalances {
  employeeId: string;
  employeeName: string;
  balances: LeaveBalance[];
}

interface RawLeaveBalance {
  id: string;
  leave_type_id: string;
  year: number;
  allocated_days: number;
  used_days: number;
  pending_days: number;
  carried_over_days: number;
  adjustment_days: number;
  leave_type: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  } | null;
}

function mapBalance(raw: RawLeaveBalance): LeaveBalance {
  const allocated = Number(raw.allocated_days) || 0;
  const used = Number(raw.used_days) || 0;
  const pending = Number(raw.pending_days) || 0;
  const carriedOver = Number(raw.carried_over_days) || 0;
  const adjustments = Number(raw.adjustment_days) || 0;
  
  return {
    id: raw.id,
    leaveTypeId: raw.leave_type_id,
    leaveTypeName: raw.leave_type?.name || 'Unknown',
    leaveTypeCode: raw.leave_type?.code || '',
    color: raw.leave_type?.color || null,
    year: raw.year,
    allocated,
    used,
    pending,
    carriedOver,
    adjustments,
    remaining: allocated + carriedOver + adjustments - used,
  };
}

/**
 * Get leave balances for the current user (employee self-service)
 * Now uses the actual leave_balances table
 */
export function useMyLeaveBalances() {
  const { companyId, employeeId } = useTenant();
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ['leave-balances', 'my', companyId, employeeId, currentYear],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('leave_balances')
        .select(`
          id,
          leave_type_id,
          year,
          allocated_days,
          used_days,
          pending_days,
          carried_over_days,
          adjustment_days,
          leave_type:leave_types(id, name, code, color)
        `)
        .eq('employee_id', employeeId)
        .eq('year', currentYear);

      if (error) throw error;

      return (data || []).map(mapBalance);
    },
    enabled: !!companyId && !!employeeId,
  });
}

/**
 * Get leave balances for a specific employee (HR/Manager view)
 */
export function useEmployeeLeaveBalances(employeeId: string | null) {
  const { companyId } = useTenant();
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ['leave-balances', 'employee', companyId, employeeId, currentYear],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('leave_balances')
        .select(`
          id,
          leave_type_id,
          year,
          allocated_days,
          used_days,
          pending_days,
          carried_over_days,
          adjustment_days,
          leave_type:leave_types(id, name, code, color)
        `)
        .eq('employee_id', employeeId)
        .eq('year', currentYear);

      if (error) throw error;

      return (data || []).map(mapBalance);
    },
    enabled: !!companyId && !!employeeId,
  });
}

/**
 * Get leave balances for all employees (HR view for Leave Management)
 */
export function useAllEmployeeLeaveBalances() {
  const { companyId } = useTenant();
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ['leave-balances', 'all', companyId, currentYear],
    queryFn: async () => {
      if (!companyId) return [];

      // Get all balances with employee and leave type info
      const { data: balances, error: balError } = await supabase
        .from('leave_balances')
        .select(`
          id,
          employee_id,
          leave_type_id,
          year,
          allocated_days,
          used_days,
          pending_days,
          carried_over_days,
          adjustment_days,
          employee:employees(id, first_name, last_name),
          leave_type:leave_types(id, name, code, color)
        `)
        .eq('company_id', companyId)
        .eq('year', currentYear);

      if (balError) throw balError;

      // Group by employee
      const employeeMap = new Map<string, EmployeeLeaveBalances>();
      
      for (const bal of balances || []) {
        const empId = bal.employee_id;
        const emp = bal.employee as { id: string; first_name: string; last_name: string } | null;
        
        if (!employeeMap.has(empId)) {
          employeeMap.set(empId, {
            employeeId: empId,
            employeeName: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
            balances: [],
          });
        }
        
        employeeMap.get(empId)!.balances.push(mapBalance({
          id: bal.id,
          leave_type_id: bal.leave_type_id,
          year: bal.year,
          allocated_days: bal.allocated_days,
          used_days: bal.used_days,
          pending_days: bal.pending_days,
          carried_over_days: bal.carried_over_days,
          adjustment_days: bal.adjustment_days,
          leave_type: bal.leave_type as { id: string; name: string; code: string; color: string | null } | null,
        }));
      }

      return Array.from(employeeMap.values());
    },
    enabled: !!companyId,
  });
}

/**
 * Accrue leave balances for the company
 */
export function useAccrueLeaveBalances() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (year?: number) => {
      if (!companyId) throw new Error('No company selected');

      const targetYear = year || new Date().getFullYear();

      const { data, error } = await supabase.rpc('accrue_leave_balances', {
        _company_id: companyId,
        _year: targetYear,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      const result = data?.[0] || { employees_processed: 0, balances_created: 0 };
      toast.success(`Accrued balances for ${result.employees_processed} employees (${result.balances_created} records)`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to accrue balances: ${error.message}`);
    },
  });
}

/**
 * Adjust leave balance for an employee
 */
export function useAdjustLeaveBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      employeeId, 
      leaveTypeId, 
      adjustmentDays, 
      reason 
    }: {
      employeeId: string;
      leaveTypeId: string;
      adjustmentDays: number;
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc('adjust_leave_balance', {
        _employee_id: employeeId,
        _leave_type_id: leaveTypeId,
        _adjustment_days: adjustmentDays,
        _reason: reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Leave balance adjusted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to adjust balance: ${error.message}`);
    },
  });
}

/**
 * Check leave balance before submitting request
 */
export function useCheckLeaveBalance() {
  return useMutation({
    mutationFn: async ({
      employeeId,
      leaveTypeId,
      days,
    }: {
      employeeId: string;
      leaveTypeId: string;
      days: number;
    }) => {
      const { data, error } = await supabase.rpc('check_leave_balance', {
        _employee_id: employeeId,
        _leave_type_id: leaveTypeId,
        _days: days,
      });

      if (error) throw error;
      return data?.[0] || { has_balance: false, available_days: 0, message: 'Unable to check balance' };
    },
  });
}
