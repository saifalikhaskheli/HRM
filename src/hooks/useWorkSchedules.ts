import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface WorkSchedule {
  id: string;
  company_id: string;
  employee_id: string | null;
  day_of_week: number;
  expected_start: string;
  expected_end: string;
  expected_hours: number;
  break_minutes: number;
  is_working_day: boolean;
  is_active: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || 'Unknown';
}

export function useCompanySchedule() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['work-schedules', 'company', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('company_id', companyId)
        .is('employee_id', null)
        .eq('is_active', true)
        .order('day_of_week');

      if (error) throw error;
      return data as WorkSchedule[];
    },
    enabled: !!companyId,
  });
}

export function useEmployeeSchedule(employeeId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['work-schedules', 'employee', employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) throw new Error('No company or employee selected');
      
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .order('day_of_week');

      if (error) throw error;
      return data as WorkSchedule[];
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useSaveCompanySchedule() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (schedules: Omit<WorkSchedule, 'id' | 'company_id' | 'is_active'>[]) => {
      if (!companyId) throw new Error('No company selected');
      
      // Delete existing company-wide schedules
      await supabase
        .from('work_schedules')
        .delete()
        .eq('company_id', companyId)
        .is('employee_id', null);

      // Insert new schedules
      const schedulesToInsert = schedules.map(s => ({
        ...s,
        company_id: companyId,
        employee_id: null,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from('work_schedules')
        .insert(schedulesToInsert)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
      toast.success('Work schedule saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save schedule: ${error.message}`);
    },
  });
}

export function useDefaultSchedule(): WorkSchedule[] {
  const { companyId } = useTenant();
  
  // Default: Mon-Fri 9am-6pm, Sat-Sun off
  return [0, 1, 2, 3, 4, 5, 6].map(day => ({
    id: '',
    company_id: companyId || '',
    employee_id: null,
    day_of_week: day,
    expected_start: '09:00:00',
    expected_end: '18:00:00',
    expected_hours: 8,
    break_minutes: 60,
    is_working_day: day >= 1 && day <= 5, // Mon-Fri
    is_active: true,
  }));
}
