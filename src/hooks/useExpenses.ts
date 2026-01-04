import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ExpenseCategory {
  id: string;
  company_id: string;
  name: string;
  code: string;
  description: string | null;
  budget_limit: number | null;
  is_active: boolean;
}

export interface Expense {
  id: string;
  company_id: string;
  employee_id: string;
  category_id: string;
  amount: number;
  currency: string;
  expense_date: string;
  description: string;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  reimbursed_at: string | null;
  created_at: string;
  employee?: {
    first_name: string;
    last_name: string;
  };
  category?: ExpenseCategory;
}

// Categories hooks
export function useExpenseCategories() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['expense-categories', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as ExpenseCategory[];
    },
    enabled: !!companyId,
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (category: { name: string; code: string; description?: string; budget_limit?: number }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('expense_categories')
        .insert({ ...category, company_id: companyId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast.success('Category created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from('expense_categories')
        .update({ is_active: false })
        .eq('id', categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast.success('Category removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove category: ${error.message}`);
    },
  });
}

// Expenses hooks
export function useMyExpenses() {
  const { companyId, employeeId } = useTenant();

  return useQuery({
    queryKey: ['expenses', 'my', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) throw new Error('No company or employee selected');
      
      const { data, error } = await supabase
        .from('expenses')
        .select('*, category:expense_categories(*)')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useAllExpenses(status?: string) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['expenses', 'all', companyId, status],
    queryFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      let query = supabase
        .from('expenses')
        .select('*, category:expense_categories(*), employee:employees!expenses_employee_id_fkey(first_name, last_name)')
        .eq('company_id', companyId)
        .order('expense_date', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as Expense[];
    },
    enabled: !!companyId,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async (expense: {
      category_id: string;
      amount: number;
      currency: string;
      expense_date: string;
      description: string;
      receipt_url?: string;
    }) => {
      if (!companyId || !employeeId) throw new Error('No company or employee selected');
      
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          ...expense,
          company_id: companyId,
          employee_id: employeeId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense submitted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit expense: ${error.message}`);
    },
  });
}

export function useApproveExpense() {
  const queryClient = useQueryClient();
  const { employeeId } = useTenant();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_by: employeeId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense approved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve expense: ${error.message}`);
    },
  });
}

export function useRejectExpense() {
  const queryClient = useQueryClient();
  const { employeeId } = useTenant();

  return useMutation({
    mutationFn: async ({ expenseId, reason }: { expenseId: string; reason: string }) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          approved_by: employeeId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense rejected');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject expense: ${error.message}`);
    },
  });
}

export function useMarkReimbursed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'reimbursed',
          reimbursed_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Marked as reimbursed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update expense: ${error.message}`);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete expense: ${error.message}`);
    },
  });
}

// Hook for managers to view team expenses (for approval workflow)
export function useTeamExpenses(status?: string) {
  const { companyId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  return useQuery({
    queryKey: ['expenses', 'team', companyId, userId, status],
    queryFn: async () => {
      if (!companyId || !userId) return [];

      // Get current employee (manager)
      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .single();

      if (!currentEmployee) return [];

      // Get direct reports
      const { data: directReports } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', currentEmployee.id)
        .neq('employment_status', 'terminated');

      const employeeIds = directReports?.map(e => e.id) || [];
      if (employeeIds.length === 0) return [];

      // Get expenses for team members
      let query = supabase
        .from('expenses')
        .select('*, category:expense_categories(*), employee:employees!expenses_employee_id_fkey(first_name, last_name)')
        .in('employee_id', employeeIds)
        .order('expense_date', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Expense[];
    },
    enabled: !!companyId && !!userId,
  });
}
