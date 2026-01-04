import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { Database, Json } from '@/integrations/supabase/types';

type EmploymentStatus = Database['public']['Enums']['employment_status'];

// Confirm employee (end probation, set to active)
export function useConfirmEmployee() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ employeeId, notes }: { employeeId: string; notes?: string }) => {
      if (!companyId) throw new Error('No company selected');

      const { error } = await supabase
        .from('employees')
        .update({
          employment_status: 'active' as EmploymentStatus,
          probation_end_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', employeeId)
        .eq('company_id', companyId);

      if (error) throw error;

      // Log audit event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'employees',
        action: 'update' as const,
        record_id: employeeId,
        new_values: { employment_status: 'active', notes },
        metadata: { action_type: 'probation_confirmed' },
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['probation-ends'] });
      toast.success('Employee confirmed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to confirm employee');
    },
  });
}

// Extend probation period
export function useExtendProbation() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      employeeId, 
      newEndDate, 
      reason 
    }: { 
      employeeId: string; 
      newEndDate: string; 
      reason: string;
    }) => {
      if (!companyId) throw new Error('No company selected');

      const { error } = await supabase
        .from('employees')
        .update({ probation_end_date: newEndDate })
        .eq('id', employeeId)
        .eq('company_id', companyId);

      if (error) throw error;

      // Log audit event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'employees',
        action: 'update' as const,
        record_id: employeeId,
        new_values: { probation_end_date: newEndDate, reason },
        metadata: { action_type: 'probation_extended' },
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['probation-ends'] });
      toast.success('Probation period extended');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to extend probation');
    },
  });
}

// Terminate employee
export function useTerminateEmployee() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      employeeId, 
      terminationDate, 
      reason,
      disableUser = true,
    }: { 
      employeeId: string; 
      terminationDate: string; 
      reason: string;
      disableUser?: boolean;
    }) => {
      if (!companyId) throw new Error('No company selected');

      // Update employee record
      const { data: employee, error } = await supabase
        .from('employees')
        .update({
          employment_status: 'terminated' as EmploymentStatus,
          termination_date: terminationDate,
          termination_reason: reason,
        })
        .eq('id', employeeId)
        .eq('company_id', companyId)
        .select('user_id')
        .single();

      if (error) throw error;

      // Optionally disable user account
      if (disableUser && employee?.user_id) {
        try {
          await supabase.functions.invoke('disable-employee-user', {
            body: { 
              companyId, 
              employeeId,
              userId: employee.user_id,
              reason: `Terminated: ${reason}`,
            },
          });
        } catch (e) {
          console.error('Failed to disable user account:', e);
        }
      }

      // Log audit event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'employees',
        action: 'update' as const,
        record_id: employeeId,
        new_values: { 
          employment_status: 'terminated',
          termination_date: terminationDate,
          termination_reason: reason,
        },
        metadata: { action_type: 'employee_terminated', user_disabled: disableUser },
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee terminated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to terminate employee');
    },
  });
}

// Rehire employee (reactivate terminated employee)
export function useRehireEmployee() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      employeeId, 
      newHireDate,
      probationEndDate,
      reactivateUser = true,
    }: { 
      employeeId: string; 
      newHireDate: string;
      probationEndDate?: string;
      reactivateUser?: boolean;
    }) => {
      if (!companyId) throw new Error('No company selected');

      // Update employee record
      const { data: employee, error } = await supabase
        .from('employees')
        .update({
          employment_status: 'active' as EmploymentStatus,
          hire_date: newHireDate,
          probation_end_date: probationEndDate || null,
          termination_date: null,
          termination_reason: null,
        })
        .eq('id', employeeId)
        .eq('company_id', companyId)
        .select('user_id')
        .single();

      if (error) throw error;

      // Optionally reactivate user account
      if (reactivateUser && employee?.user_id) {
        try {
          await supabase.functions.invoke('reactivate-employee-user', {
            body: { 
              companyId, 
              employeeId,
              userId: employee.user_id,
            },
          });
        } catch (e) {
          console.error('Failed to reactivate user account:', e);
        }
      }

      // Log audit event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'employees',
        action: 'update' as const,
        record_id: employeeId,
        new_values: { 
          employment_status: 'active',
          hire_date: newHireDate,
        },
        metadata: { action_type: 'employee_rehired', user_reactivated: reactivateUser },
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee rehired successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to rehire employee');
    },
  });
}

// Promote employee (change job title, department, salary)
export function usePromoteEmployee() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      employeeId,
      newJobTitle,
      newDepartmentId,
      newSalary,
      effectiveDate,
      reason,
    }: { 
      employeeId: string;
      newJobTitle?: string;
      newDepartmentId?: string;
      newSalary?: number;
      effectiveDate: string;
      reason: string;
    }) => {
      if (!companyId) throw new Error('No company selected');

      // Build update object
      const updates: Record<string, unknown> = {};
      if (newJobTitle) updates.job_title = newJobTitle;
      if (newDepartmentId) updates.department_id = newDepartmentId;
      if (newSalary) updates.salary = newSalary;

      if (Object.keys(updates).length === 0) {
        throw new Error('No changes specified');
      }

      const { error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', employeeId)
        .eq('company_id', companyId);

      if (error) throw error;

      // If salary changed, add to salary history
      if (newSalary) {
        await supabase.from('salary_history').insert([{
          company_id: companyId,
          employee_id: employeeId,
          base_salary: newSalary,
          effective_from: effectiveDate,
          reason,
        }]);
      }

      // Log audit event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'employees',
        action: 'update' as const,
        record_id: employeeId,
        new_values: updates as Json,
        metadata: { action_type: 'employee_promoted', reason, effective_date: effectiveDate },
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['salary-history'] });
      toast.success('Employee promoted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to promote employee');
    },
  });
}

// Transfer employee to different department
export function useTransferEmployee() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      employeeId,
      newDepartmentId,
      newManagerId,
      effectiveDate,
      reason,
    }: { 
      employeeId: string;
      newDepartmentId: string;
      newManagerId?: string;
      effectiveDate: string;
      reason: string;
    }) => {
      if (!companyId) throw new Error('No company selected');

      const updates: Record<string, unknown> = {
        department_id: newDepartmentId,
      };
      if (newManagerId) updates.manager_id = newManagerId;

      const { error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', employeeId)
        .eq('company_id', companyId);

      if (error) throw error;

      // Log audit event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'employees',
        action: 'update' as const,
        record_id: employeeId,
        new_values: updates as Json,
        metadata: { action_type: 'employee_transferred', reason, effective_date: effectiveDate },
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee transferred successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to transfer employee');
    },
  });
}
