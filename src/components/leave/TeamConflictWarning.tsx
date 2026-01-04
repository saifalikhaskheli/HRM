import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, AlertTriangle } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';

interface TeamConflictWarningProps {
  startDate: string;
  endDate: string;
}

export function TeamConflictWarning({ startDate, endDate }: TeamConflictWarningProps) {
  const { companyId, employeeId } = useTenant();

  const { data: conflicts } = useQuery({
    queryKey: ['team-conflicts', companyId, employeeId, startDate, endDate],
    queryFn: async () => {
      if (!companyId || !employeeId || !startDate || !endDate) return [];

      // Get employee's manager
      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('manager_id, department_id')
        .eq('id', employeeId)
        .single();

      if (!currentEmployee?.manager_id && !currentEmployee?.department_id) return [];

      // Get colleagues (same manager or same department)
      const { data: colleagues } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', companyId)
        .neq('id', employeeId)
        .neq('employment_status', 'terminated')
        .or(`manager_id.eq.${currentEmployee.manager_id},department_id.eq.${currentEmployee.department_id}`);

      if (!colleagues || colleagues.length === 0) return [];

      const colleagueIds = colleagues.map(c => c.id);

      // Get approved leaves that overlap with requested dates
      const { data: overlappingLeaves } = await supabase
        .from('leave_requests')
        .select(`
          id,
          start_date,
          end_date,
          employee:employees(id, first_name, last_name),
          leave_type:leave_types(name)
        `)
        .eq('company_id', companyId)
        .in('employee_id', colleagueIds)
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      return overlappingLeaves || [];
    },
    enabled: !!companyId && !!employeeId && !!startDate && !!endDate,
  });

  if (!conflicts || conflicts.length === 0) return null;

  return (
    <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <Users className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <div className="font-medium flex items-center gap-1 mb-1">
          <AlertTriangle className="h-3 w-3" />
          Team members on leave during this period:
        </div>
        <ul className="text-sm space-y-0.5">
          {conflicts.slice(0, 5).map((conflict: any) => (
            <li key={conflict.id}>
              <strong>{conflict.employee?.first_name} {conflict.employee?.last_name}</strong>
              {' — '}
              {format(parseISO(conflict.start_date), 'MMM d')} to {format(parseISO(conflict.end_date), 'MMM d')}
              {conflict.leave_type?.name && ` (${conflict.leave_type.name})`}
            </li>
          ))}
          {conflicts.length > 5 && (
            <li className="text-muted-foreground">
              ...and {conflicts.length - 5} more
            </li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
