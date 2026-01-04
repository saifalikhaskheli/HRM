import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface SalaryHistory {
  id: string;
  employee_id: string;
  company_id: string;
  base_salary: number;
  salary_currency: string;
  salary_structure: Record<string, number> | null;
  effective_from: string;
  effective_to: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryHistoryInsert {
  employee_id: string;
  base_salary: number;
  salary_currency?: string;
  salary_structure?: Record<string, number> | null;
  effective_from: string;
  reason?: string;
}

// Get current salary for an employee
export function useCurrentSalary(employeeId: string | null) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['current-salary', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return null;
      
      const { data, error } = await supabase
        .from('salary_history')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .is('effective_to', null)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as SalaryHistory | null;
    },
    enabled: !!companyId && !!employeeId,
  });
}

// Get salary history for an employee
export function useSalaryHistory(employeeId: string | null) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['salary-history', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];
      
      const { data, error } = await supabase
        .from('salary_history')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .order('effective_from', { ascending: false });
      
      if (error) throw error;
      return data as SalaryHistory[];
    },
    enabled: !!companyId && !!employeeId,
  });
}

// Add new salary record (closes previous if exists)
export function useAddSalary() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (salary: SalaryHistoryInsert) => {
      if (!companyId) throw new Error('No company context');
      
      // First, close any existing open salary records
      const { error: updateError } = await supabase
        .from('salary_history')
        .update({ 
          effective_to: new Date(new Date(salary.effective_from).getTime() - 86400000).toISOString().split('T')[0]
        })
        .eq('company_id', companyId)
        .eq('employee_id', salary.employee_id)
        .is('effective_to', null);
      
      if (updateError) throw updateError;
      
      // Insert new salary record
      const { data, error } = await supabase
        .from('salary_history')
        .insert({
          ...salary,
          company_id: companyId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['salary-history', companyId, variables.employee_id] });
      queryClient.invalidateQueries({ queryKey: ['current-salary', companyId, variables.employee_id] });
      toast.success('Salary record added');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add salary');
    },
  });
}
