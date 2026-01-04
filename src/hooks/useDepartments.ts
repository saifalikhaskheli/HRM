import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Department = Tables<'departments'>;
export type DepartmentInsert = TablesInsert<'departments'>;
export type DepartmentUpdate = TablesUpdate<'departments'>;

export function useDepartments() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['departments', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('departments')
        .select(`
          *,
          manager:employees!fk_departments_manager(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (department: Omit<DepartmentInsert, 'company_id'>) => {
      if (!companyId) throw new Error('No company selected');

      const { data, error } = await supabase
        .from('departments')
        .insert({ ...department, company_id: companyId })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'departments',
        action: 'create',
        record_id: data.id,
        new_values: data,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', companyId] });
      toast.success('Department created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create department');
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, ...updates }: DepartmentUpdate & { id: string }) => {
      const { data: oldData } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('departments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'departments',
        action: 'update',
        record_id: id,
        old_values: oldData,
        new_values: data,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', companyId] });
      toast.success('Department updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update department');
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: oldData } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'departments',
        action: 'delete',
        record_id: id,
        old_values: oldData,
      });

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', companyId] });
      toast.success('Department deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete department');
    },
  });
}
