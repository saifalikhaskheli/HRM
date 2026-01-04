import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar, Timer, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface ProfileShiftAttendanceProps {
  employeeId: string;
}

interface ShiftInfo {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface AttendanceSummary {
  days_present: number;
  days_late: number;
  total_working_hours: number;
  overtime_hours: number;
  total_working_days: number;
}

export function ProfileShiftAttendance({ employeeId }: ProfileShiftAttendanceProps) {
  const { companyId } = useTenant();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Get current shift assignment
  const { data: currentShift, isLoading: loadingShift } = useQuery({
    queryKey: ['employee-current-shift', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return null;

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('employee_shift_assignments')
        .select(`
          id,
          effective_from,
          effective_to,
          is_temporary,
          shift:shifts(id, name, start_time, end_time)
        `)
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.shift as ShiftInfo | null;
    },
    enabled: !!companyId && !!employeeId,
  });

  // Get attendance summary for current month
  const { data: attendanceSummary, isLoading: loadingAttendance } = useQuery({
    queryKey: ['employee-attendance-summary', companyId, employeeId, monthStart.toISOString()],
    queryFn: async () => {
      if (!companyId || !employeeId) return null;

      const { data, error } = await supabase
        .from('attendance_summaries')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .gte('period_start', monthStart.toISOString().split('T')[0])
        .lte('period_end', monthEnd.toISOString().split('T')[0])
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as AttendanceSummary | null;
    },
    enabled: !!companyId && !!employeeId,
  });

  const isLoading = loadingShift || loadingAttendance;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatTime = (time: string) => {
    return format(new Date(`2000-01-01T${time}`), 'h:mm a');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Shift & Attendance
        </CardTitle>
        <CardDescription>
          Your current shift and attendance summary for {format(now, 'MMMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Shift */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Shift</h4>
          {currentShift ? (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{currentShift.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTime(currentShift.start_time)} - {formatTime(currentShift.end_time)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No shift assigned</p>
          )}
        </div>

        {/* Attendance Summary */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">This Month's Summary</h4>
          {attendanceSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{attendanceSummary.days_present}</p>
                <p className="text-xs text-muted-foreground">Days Present</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold">{attendanceSummary.total_working_days}</p>
                <p className="text-xs text-muted-foreground">Working Days</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <Timer className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{attendanceSummary.total_working_hours.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Hours Worked</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <Clock className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{attendanceSummary.overtime_hours.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Overtime Hours</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No attendance data available for this month.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
