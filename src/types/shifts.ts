// Shift Management types

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Shift {
  id: string;
  company_id: string;
  name: string;
  start_time: string; // TIME format HH:MM:SS
  end_time: string;
  break_duration_minutes: number;
  grace_period_minutes: number;
  min_hours_full_day: number;
  min_hours_half_day: number;
  overtime_after_minutes: number | null;
  applicable_days: DayOfWeek[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type ShiftInsert = Omit<Shift, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type ShiftUpdate = Partial<ShiftInsert>;

export interface EmployeeShiftAssignment {
  id: string;
  company_id: string;
  employee_id: string;
  shift_id: string;
  effective_from: string; // DATE format YYYY-MM-DD
  effective_to: string | null;
  is_temporary: boolean;
  reason: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftAssignmentWithShift extends EmployeeShiftAssignment {
  shift: Shift;
}

export interface ShiftAssignmentWithEmployee extends EmployeeShiftAssignment {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    department?: {
      id: string;
      name: string;
    } | null;
  };
  shift: Shift;
}

export type ShiftAssignmentInsert = Omit<EmployeeShiftAssignment, 'id' | 'created_at' | 'updated_at' | 'assigned_by'> & {
  effective_to?: string | null;
  reason?: string | null;
};
export type ShiftAssignmentUpdate = Partial<ShiftAssignmentInsert>;

export interface AttendanceSummary {
  id: string;
  company_id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  total_working_days: number;
  days_present: number;
  days_late: number;
  half_day_absents: number;
  full_day_absents: number;
  total_working_hours: number;
  overtime_hours: number;
  calculated_from: string | null;
  calculated_to: string | null;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Day labels for UI
export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const ALL_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const WEEKDAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
