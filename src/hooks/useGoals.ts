import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface Goal {
  id: string;
  company_id: string;
  employee_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  progress_percentage: number;
  progress: number; // alias for progress_percentage
  status: 'not_started' | 'in_progress' | 'at_risk' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  progress_notes: { date: string; note: string; progress: number }[];
  last_progress_update: string | null;
  review_id: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    job_title?: string | null;
  };
}

export interface CreateGoalInput {
  employee_id?: string;
  title: string;
  description?: string;
  target_date?: string;
  review_id?: string;
  priority?: string;
  status?: string;
  progress?: number;
}

export type GoalUpdate = Partial<CreateGoalInput> & {
  progress_percentage?: number;
};

// Fetch my goals
export function useMyGoals() {
  const { companyId, employeeId } = useTenant();

  return useQuery({
    queryKey: ['goals', 'my', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') return [];
        throw error;
      }
      return data as Goal[];
    },
    enabled: !!companyId && !!employeeId,
  });
}

// Fetch all goals for the company (HR view)
export function useGoals() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['goals', 'all', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('goals')
        .select(`
          *,
          employee:employees!goals_employee_id_fkey(id, first_name, last_name, job_title)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') return [];
        throw error;
      }
      return data as Goal[];
    },
    enabled: !!companyId,
  });
}

// Fetch goals for an employee (for managers/HR)
export function useEmployeeGoals(employeeId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['goals', 'employee', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data as Goal[];
    },
    enabled: !!companyId && !!employeeId,
  });
}

// Fetch team goals (for managers)
export function useTeamGoals() {
  const { companyId, employeeId } = useTenant();

  return useQuery({
    queryKey: ['goals', 'team', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      // Get direct reports
      const { data: directReports } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', employeeId);

      const reportIds = directReports?.map(e => e.id) || [];
      if (reportIds.length === 0) return [];

      const { data, error } = await supabase
        .from('goals')
        .select(`
          *,
          employee:employees!goals_employee_id_fkey(id, first_name, last_name, job_title)
        `)
        .eq('company_id', companyId)
        .in('employee_id', reportIds)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data as Goal[];
    },
    enabled: !!companyId && !!employeeId,
  });
}

// Create a goal
export function useCreateGoal() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();

  return useMutation({
    mutationFn: async (goal: CreateGoalInput) => {
      if (!companyId) throw new Error('No company selected');

      const targetEmployeeId = goal.employee_id || employeeId;
      if (!targetEmployeeId) throw new Error('No employee selected');

      const { data, error } = await supabase
        .from('goals')
        .insert({
          company_id: companyId,
          employee_id: targetEmployeeId,
          title: goal.title,
          description: goal.description || null,
          target_date: goal.target_date || null,
          review_id: goal.review_id || null,
          progress_percentage: goal.progress ?? 0,
          status: goal.status || 'not_started',
          progress_notes: [],
        })
        .select()
        .single();

      if (error) throw error;

      // Add audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'goals',
        action: 'create' as const,
        record_id: data.id,
        new_values: { title: data.title, employee_id: targetEmployeeId },
      }]);

      return data as Goal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Goal created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create goal');
    },
  });
}

// Update a goal
export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, ...updates }: GoalUpdate & { id: string }) => {
      if (!companyId) throw new Error('No company selected');

      const updateData: Record<string, unknown> = { ...updates };
      if (updates.progress_percentage !== undefined) {
        updateData.last_progress_update = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('goals')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;

      // Add audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'goals',
        action: 'update' as const,
        record_id: id,
        new_values: updates,
      }]);

      return data as Goal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Goal updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update goal');
    },
  });
}

// Update goal progress
export function useUpdateGoalProgress() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ id, progress, note }: { id: string; progress: number; note?: string }) => {
      if (!companyId) throw new Error('No company selected');

      // Get current goal to append to progress notes
      const { data: currentGoal } = await supabase
        .from('goals')
        .select('progress_notes, status')
        .eq('id', id)
        .single();

      const progressNotes = (currentGoal?.progress_notes as unknown[]) || [];
      if (note) {
        progressNotes.push({
          date: new Date().toISOString(),
          note,
          progress,
        });
      }

      // Auto-update status based on progress
      let newStatus = currentGoal?.status;
      if (progress === 100) {
        newStatus = 'completed';
      } else if (progress > 0 && currentGoal?.status === 'not_started') {
        newStatus = 'in_progress';
      }

      const { data, error } = await supabase
        .from('goals')
        .update({
          progress_percentage: progress,
          progress_notes: JSON.parse(JSON.stringify(progressNotes)),
          last_progress_update: new Date().toISOString(),
          status: newStatus,
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data as Goal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Progress updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update progress');
    },
  });
}

// Delete a goal
export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error('No company selected');

      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      // Add audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'goals',
        action: 'delete' as const,
        record_id: id,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Goal deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete goal');
    },
  });
}
