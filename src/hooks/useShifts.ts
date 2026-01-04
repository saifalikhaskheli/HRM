import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { Shift, ShiftInsert, ShiftUpdate, EmployeeShiftAssignment, ShiftAssignmentWithEmployee, ShiftAssignmentInsert, DayOfWeek } from '@/types/shifts';

// =============================================
// SHIFTS HOOKS
// =============================================

export function useShifts() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['shifts', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as Shift[];
    },
    enabled: !!companyId,
  });
}

export function useActiveShifts() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['shifts', companyId, 'active'],
    queryFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as Shift[];
    },
    enabled: !!companyId,
  });
}

export function useShift(shiftId: string | null) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['shifts', companyId, shiftId],
    queryFn: async () => {
      if (!companyId || !shiftId) throw new Error('No company or shift selected');
      
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', shiftId)
        .eq('company_id', companyId)
        .single();
      
      if (error) throw error;
      return data as Shift;
    },
    enabled: !!companyId && !!shiftId,
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async (shift: Omit<ShiftInsert, 'company_id'>) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          ...shift,
          company_id: companyId,
          applicable_days: shift.applicable_days as string[],
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', companyId] });
      toast.success('Shift created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create shift');
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: ShiftUpdate & { id: string }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('shifts')
        .update({
          ...updates,
          applicable_days: updates.applicable_days as string[] | undefined,
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();
      
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shifts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['shifts', companyId, variables.id] });
      toast.success('Shift updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update shift');
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async (shiftId: string) => {
      if (!companyId) throw new Error('No company selected');
      
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId)
        .eq('company_id', companyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', companyId] });
      toast.success('Shift deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete shift');
    },
  });
}

// =============================================
// SHIFT ASSIGNMENTS HOOKS
// =============================================

export function useEmployeeShiftAssignments(employeeId: string | null) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['shift-assignments', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) throw new Error('No company or employee selected');
      
      const { data, error } = await supabase
        .from('employee_shift_assignments')
        .select(`
          *,
          shift:shifts(*)
        `)
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .order('effective_from', { ascending: false });
      
      if (error) throw error;
      return data as (EmployeeShiftAssignment & { shift: Shift })[];
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useCurrentEmployeeShift(employeeId: string | null) {
  const { companyId } = useTenant();
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['shift-assignments', companyId, employeeId, 'current'],
    queryFn: async () => {
      if (!companyId || !employeeId) throw new Error('No company or employee selected');
      
      const { data, error } = await supabase
        .from('employee_shift_assignments')
        .select(`
          *,
          shift:shifts(*)
        `)
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as (EmployeeShiftAssignment & { shift: Shift }) | null;
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useAllShiftAssignments() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['shift-assignments', companyId, 'all'],
    queryFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('employee_shift_assignments')
        .select(`
          *,
          employee:employees(id, first_name, last_name, employee_number, department:departments(id, name)),
          shift:shifts(*)
        `)
        .eq('company_id', companyId)
        .order('effective_from', { ascending: false });
      
      if (error) throw error;
      return data as ShiftAssignmentWithEmployee[];
    },
    enabled: !!companyId,
  });
}

export function useAssignShift() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async (assignment: {
      employee_id: string;
      shift_id: string;
      effective_from: string;
      effective_to?: string | null;
      is_temporary: boolean;
      reason?: string | null;
    }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('employee_shift_assignments')
        .insert({
          ...assignment,
          company_id: companyId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as EmployeeShiftAssignment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shift-assignments', companyId] });
      queryClient.invalidateQueries({ queryKey: ['shift-assignments', companyId, variables.employee_id] });
      toast.success('Shift assigned successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign shift');
    },
  });
}

export function useEndShiftAssignment() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ assignmentId, endDate }: { assignmentId: string; endDate: string }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('employee_shift_assignments')
        .update({ effective_to: endDate })
        .eq('id', assignmentId)
        .eq('company_id', companyId)
        .select()
        .single();
      
      if (error) throw error;
      return data as EmployeeShiftAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-assignments', companyId] });
      toast.success('Shift assignment ended');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to end shift assignment');
    },
  });
}

export function useDeleteShiftAssignment() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!companyId) throw new Error('No company selected');
      
      const { error } = await supabase
        .from('employee_shift_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('company_id', companyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-assignments', companyId] });
      toast.success('Shift assignment deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete shift assignment');
    },
  });
}

// =============================================
// DEFAULT SHIFT HOOK
// =============================================

export function useDefaultShift() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['shifts', companyId, 'default'],
    queryFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as Shift | null;
    },
    enabled: !!companyId,
  });
}

export function useEnsureDefaultShift() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      // Check if default exists
      const { data: existing } = await supabase
        .from('shifts')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_default', true)
        .maybeSingle();
      
      if (existing) return existing;
      
      // Create default shift
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          company_id: companyId,
          name: 'General Shift',
          start_time: '09:00:00',
          end_time: '18:00:00',
          break_duration_minutes: 60,
          grace_period_minutes: 15,
          min_hours_full_day: 8,
          min_hours_half_day: 4,
          applicable_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          is_default: true,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', companyId] });
    },
  });
}
