import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

export type TimeEntry = Tables<'time_entries'>;

// Clock status enum for clear state management
export type ClockStatus = 'not_started' | 'clocked_in' | 'on_break' | 'clocked_out';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
}

export interface TimeBreak {
  id: string;
  time_entry_id: string;
  break_start: string;
  break_end: string | null;
  duration_minutes: number | null;
}

// Helper to get current location
export async function getCurrentLocation(): Promise<GeoLocation | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        });
      },
      () => {
        // Location denied or error - continue without location
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

export function useMyTimeEntries(startDate?: string, endDate?: string) {
  const { companyId, employeeId } = useTenant();

  return useQuery({
    queryKey: ['time-entries', 'my', companyId, employeeId, startDate, endDate],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .order('date', { ascending: false });

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useTeamTimeEntries(startDate?: string, endDate?: string) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['time-entries', 'team', companyId, startDate, endDate],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('time_entries')
        .select(`
          *,
          employee:employees!time_entries_employee_id_fkey(id, first_name, last_name, email)
        `)
        .eq('company_id', companyId)
        .order('date', { ascending: false });

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query.limit(500);

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useTodayEntry() {
  const { employeeId } = useTenant();
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['time-entries', 'today', employeeId],
    queryFn: async () => {
      if (!employeeId) return null;

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });
}

// Fetch active break for today's entry
export function useActiveBreak() {
  const { employeeId } = useTenant();
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['time-entry-breaks', 'active', employeeId, today],
    queryFn: async () => {
      if (!employeeId) return null;

      // First get today's entry
      const { data: entry } = await supabase
        .from('time_entries')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (!entry) return null;

      // Then get active break (no end time)
      const { data: activeBreak, error } = await supabase
        .from('time_entry_breaks')
        .select('*')
        .eq('time_entry_id', entry.id)
        .is('break_end', null)
        .maybeSingle();

      if (error) throw error;
      return activeBreak;
    },
    enabled: !!employeeId,
  });
}

// Fetch all breaks for today's entry
export function useTodayBreaks() {
  const { employeeId } = useTenant();
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['time-entry-breaks', 'today', employeeId, today],
    queryFn: async () => {
      if (!employeeId) return [];

      // First get today's entry
      const { data: entry } = await supabase
        .from('time_entries')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (!entry) return [];

      const { data, error } = await supabase
        .from('time_entry_breaks')
        .select('*')
        .eq('time_entry_id', entry.id)
        .order('break_start', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });
}

// Helper to determine current clock status (including break status)
export function getClockStatus(
  entry: TimeEntry | null | undefined,
  activeBreak: { id: string } | null | undefined
): ClockStatus {
  if (!entry || !entry.clock_in) return 'not_started';
  if (entry.clock_out) return 'clocked_out';
  if (activeBreak) return 'on_break';
  return 'clocked_in';
}

// Get work schedule for a specific day
export function useWorkSchedule(dayOfWeek?: number) {
  const { companyId, employeeId } = useTenant();
  const currentDay = dayOfWeek ?? new Date().getDay();

  return useQuery({
    queryKey: ['work-schedule', companyId, employeeId, currentDay],
    queryFn: async () => {
      if (!companyId) return null;

      // First try employee-specific schedule
      if (employeeId) {
        const { data: empSchedule } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('company_id', companyId)
          .eq('employee_id', employeeId)
          .eq('day_of_week', currentDay)
          .eq('is_active', true)
          .maybeSingle();

        if (empSchedule) return empSchedule;
      }

      // Fall back to company-wide schedule
      const { data: companySchedule, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('company_id', companyId)
        .is('employee_id', null)
        .eq('day_of_week', currentDay)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return companySchedule;
    },
    enabled: !!companyId,
  });
}

// Calculate overtime based on schedule
export function calculateOvertime(
  totalHours: number,
  schedule: { expected_hours: number } | null,
  dailyLimit: number = 8
): number {
  const expectedHours = schedule?.expected_hours ?? dailyLimit;
  return Math.max(0, totalHours - expectedHours);
}

export function useClockIn() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();
  const today = new Date().toISOString().split('T')[0];

  return useMutation({
    mutationFn: async () => {
      if (!companyId || !employeeId) throw new Error('No company or employee selected');

      // Check if already clocked in today
      const { data: existingEntry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (existingEntry?.clock_in && !existingEntry?.clock_out) {
        throw new Error('You are already clocked in. Please clock out first.');
      }

      if (existingEntry?.clock_out) {
        throw new Error('You have already completed your shift for today. Contact your manager if you need to make corrections.');
      }

      // Get current location
      const location = await getCurrentLocation();
      const now = new Date().toISOString();

      // Create new entry
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          company_id: companyId,
          employee_id: employeeId,
          date: today,
          clock_in: now,
          clock_in_location: location as any,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('You have already clocked in today.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Clocked in successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to clock in');
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();
  const today = new Date().toISOString().split('T')[0];

  return useMutation({
    mutationFn: async () => {
      if (!employeeId || !companyId) throw new Error('No employee selected');

      // Get current entry
      const { data: entry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (!entry?.clock_in) {
        throw new Error('You must clock in first before clocking out.');
      }

      if (entry.clock_out) {
        throw new Error('You have already clocked out for today.');
      }

      // Check for active break - end it first
      const { data: activeBreak } = await supabase
        .from('time_entry_breaks')
        .select('*')
        .eq('time_entry_id', entry.id)
        .is('break_end', null)
        .maybeSingle();

      if (activeBreak) {
        // End the active break
        const breakEnd = new Date();
        const breakStart = new Date(activeBreak.break_start);
        const duration = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));

        await supabase
          .from('time_entry_breaks')
          .update({
            break_end: breakEnd.toISOString(),
            duration_minutes: duration,
          })
          .eq('id', activeBreak.id);
      }

      // Calculate total break minutes from all breaks
      const { data: allBreaks } = await supabase
        .from('time_entry_breaks')
        .select('duration_minutes')
        .eq('time_entry_id', entry.id);

      const totalBreakMinutes = (allBreaks || []).reduce(
        (sum, b) => sum + (b.duration_minutes || 0),
        0
      );

      // Get location and calculate hours
      const location = await getCurrentLocation();
      const now = new Date();
      const clockIn = new Date(entry.clock_in);
      const totalMinutes = Math.round((now.getTime() - clockIn.getTime()) / (1000 * 60));
      const workMinutes = totalMinutes - totalBreakMinutes;
      const totalHours = Math.max(0, workMinutes / 60);

      // Get work schedule to calculate overtime
      const { data: schedule } = await supabase
        .from('work_schedules')
        .select('expected_hours')
        .eq('company_id', companyId)
        .is('employee_id', null)
        .eq('day_of_week', now.getDay())
        .eq('is_active', true)
        .maybeSingle();

      const overtimeHours = calculateOvertime(totalHours, schedule);

      const { data, error } = await supabase
        .from('time_entries')
        .update({
          clock_out: now.toISOString(),
          clock_out_location: location as any,
          break_minutes: totalBreakMinutes,
          total_hours: Math.round(totalHours * 100) / 100,
          overtime_hours: Math.round(overtimeHours * 100) / 100,
        })
        .eq('id', entry.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry-breaks'] });
      toast.success('Clocked out successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to clock out');
    },
  });
}

export function useStartBreak() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();
  const today = new Date().toISOString().split('T')[0];

  return useMutation({
    mutationFn: async () => {
      if (!companyId || !employeeId) throw new Error('No company or employee selected');

      // Get today's entry
      const { data: entry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (!entry?.clock_in) {
        throw new Error('You must clock in first before taking a break.');
      }

      if (entry.clock_out) {
        throw new Error('Cannot start break - you have already clocked out.');
      }

      // Check for existing active break
      const { data: existingBreak } = await supabase
        .from('time_entry_breaks')
        .select('id')
        .eq('time_entry_id', entry.id)
        .is('break_end', null)
        .maybeSingle();

      if (existingBreak) {
        throw new Error('You are already on a break. End your current break first.');
      }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('time_entry_breaks')
        .insert({
          time_entry_id: entry.id,
          company_id: companyId,
          employee_id: employeeId,
          break_start: now,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entry-breaks'] });
      toast.success('Break started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start break');
    },
  });
}

export function useEndBreak() {
  const queryClient = useQueryClient();
  const { employeeId } = useTenant();
  const today = new Date().toISOString().split('T')[0];

  return useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error('No employee selected');

      // Get today's entry
      const { data: entry } = await supabase
        .from('time_entries')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (!entry) {
        throw new Error('No time entry found for today.');
      }

      // Get active break
      const { data: activeBreak } = await supabase
        .from('time_entry_breaks')
        .select('*')
        .eq('time_entry_id', entry.id)
        .is('break_end', null)
        .maybeSingle();

      if (!activeBreak) {
        throw new Error('No active break to end.');
      }

      const breakEnd = new Date();
      const breakStart = new Date(activeBreak.break_start);
      const duration = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));

      const { data, error } = await supabase
        .from('time_entry_breaks')
        .update({
          break_end: breakEnd.toISOString(),
          duration_minutes: duration,
        })
        .eq('id', activeBreak.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entry-breaks'] });
      toast.success('Break ended');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to end break');
    },
  });
}

export function useApproveTimeEntry() {
  const queryClient = useQueryClient();
  const { employeeId } = useTenant();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update({
          is_approved: true,
          approved_by: employeeId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Time entry approved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve entry');
    },
  });
}

export function useBulkApproveTimeEntries() {
  const queryClient = useQueryClient();
  const { employeeId } = useTenant();

  return useMutation({
    mutationFn: async (entryIds: string[]) => {
      if (entryIds.length === 0) throw new Error('No entries selected');

      const { data, error } = await supabase
        .from('time_entries')
        .update({
          is_approved: true,
          approved_by: employeeId,
          approved_at: new Date().toISOString(),
        })
        .in('id', entryIds)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success(`${data?.length || 0} time entries approved`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve entries');
    },
  });
}

export function useRejectTimeEntry() {
  const queryClient = useQueryClient();
  const { employeeId } = useTenant();

  return useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason: string }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update({
          is_approved: false,
          approved_by: employeeId,
          approved_at: new Date().toISOString(),
          notes: reason,
        })
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Time entry rejected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject entry');
    },
  });
}

// Calculate time summaries
export function useTimeSummary() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const { data: entries = [] } = useMyTimeEntries(
    startOfMonth.toISOString().split('T')[0]
  );

  const today = now.toISOString().split('T')[0];
  const weekStart = startOfWeek.toISOString().split('T')[0];

  const todayHours = entries
    .filter(e => e.date === today)
    .reduce((sum, e) => sum + (e.total_hours || 0), 0);

  const weekHours = entries
    .filter(e => e.date >= weekStart)
    .reduce((sum, e) => sum + (e.total_hours || 0), 0);

  const monthHours = entries
    .reduce((sum, e) => sum + (e.total_hours || 0), 0);

  const weekOvertime = entries
    .filter(e => e.date >= weekStart)
    .reduce((sum, e) => sum + (e.overtime_hours || 0), 0);

  return {
    todayHours,
    weekHours,
    monthHours,
    weekOvertime,
    entries,
  };
}

// Calculate total break duration for today
export function useTotalBreakDuration() {
  const { data: breaks = [] } = useTodayBreaks();
  
  const completedMinutes = breaks
    .filter(b => b.duration_minutes)
    .reduce((sum, b) => sum + (b.duration_minutes || 0), 0);

  // Add ongoing break duration if exists
  const activeBreak = breaks.find(b => !b.break_end);
  let ongoingMinutes = 0;
  if (activeBreak) {
    const start = new Date(activeBreak.break_start).getTime();
    ongoingMinutes = Math.floor((Date.now() - start) / (1000 * 60));
  }

  return {
    completedMinutes,
    ongoingMinutes,
    totalMinutes: completedMinutes + ongoingMinutes,
    breakCount: breaks.length,
  };
}
