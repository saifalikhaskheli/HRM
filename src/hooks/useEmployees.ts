import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Employee = Tables<'employees'>;
export type EmployeeInsert = TablesInsert<'employees'>;
export type EmployeeUpdate = TablesUpdate<'employees'>;

export function useEmployees() {
  const { companyId, isFrozen } = useTenant();

  return useQuery({
    queryKey: ['employees', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments!employees_department_id_fkey(id, name)
        `)
        .eq('company_id', companyId)
        .order('last_name', { ascending: true });

      if (error) throw error;
      
      // Map manager info from the same dataset (self-reference)
      const employeeMap = new Map((data || []).map(e => [e.id, e]));
      return (data || []).map(emp => ({
        ...emp,
        manager: emp.manager_id ? employeeMap.get(emp.manager_id) : null,
      }));
    },
    enabled: !!companyId,
    meta: { isFrozen },
  });
}

export function useEmployee(employeeId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['employee', employeeId],
    queryFn: async () => {
      if (!employeeId) return null;

      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments!employees_department_id_fkey(id, name)
        `)
        .eq('id', employeeId)
        .maybeSingle();

      if (error) throw error;
      
      // Fetch manager separately if exists
      if (data?.manager_id) {
        const { data: manager } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .eq('id', data.manager_id)
          .maybeSingle();
        return { ...data, manager };
      }
      
      return { ...data, manager: null };
    },
    enabled: !!employeeId && !!companyId,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  const { companyId, isFrozen } = useTenant();

  return useMutation({
    mutationFn: async (employee: Omit<EmployeeInsert, 'company_id'>) => {
      if (!companyId) throw new Error('No company selected');
      if (isFrozen) throw new Error('Company account is frozen. Please update billing.');

      const { data, error } = await supabase
        .from('employees')
        .insert({ ...employee, company_id: companyId })
        .select()
        .single();

      if (error) throw error;

      // Audit log (non-blocking)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('audit_logs').insert([{
            company_id: companyId,
            user_id: user.id,
            table_name: 'employees',
            action: 'create' as const,
            record_id: data.id,
            new_values: data,
          }]).then(({ error }) => {
            if (error) console.error('Audit log error:', error);
          });
        }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees-without-user', companyId] });
      toast.success('Employee created successfully');
    },
    onError: (error: Error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  const { companyId, isFrozen } = useTenant();

  return useMutation({
    mutationFn: async ({ id, ...updates }: EmployeeUpdate & { id: string }) => {
      if (!companyId) throw new Error('No company selected');
      if (isFrozen) throw new Error('Company account is frozen. Please update billing.');

      const { data: oldData } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Audit log (non-blocking)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('audit_logs').insert([{
            company_id: companyId,
            user_id: user.id,
            table_name: 'employees',
            action: 'update' as const,
            record_id: id,
            old_values: oldData,
            new_values: data,
          }]).then(({ error }) => {
            if (error) console.error('Audit log error:', error);
          });
        }
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['employees-without-user', companyId] });
      toast.success('Employee updated successfully');
    },
    onError: (error: Error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  const { companyId, isFrozen } = useTenant();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error('No company selected');
      if (isFrozen) throw new Error('Company account is frozen. Please update billing.');

      const { data: oldData } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Audit log (non-blocking)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('audit_logs').insert([{
            company_id: companyId,
            user_id: user.id,
            table_name: 'employees',
            action: 'delete' as const,
            record_id: id,
            old_values: oldData,
          }]).then(({ error }) => {
            if (error) console.error('Audit log error:', error);
          });
        }
      });

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      toast.success('Employee deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
