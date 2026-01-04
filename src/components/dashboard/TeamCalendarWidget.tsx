import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addMonths, 
  subMonths,
  isWithinInterval,
  parseISO,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { useTeamLeaves } from '@/hooks/useMyTeam';
import { cn } from '@/lib/utils';

interface LeaveEvent {
  id: string;
  employee_name: string;
  employee_initials: string;
  leave_type: string;
  leave_color: string;
  start_date: string;
  end_date: string;
}

export function TeamCalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: teamLeaves, isLoading } = useTeamLeaves();

  // Transform team leaves data
  const leaveEvents: LeaveEvent[] = (teamLeaves || []).map((leave: any) => {
    const emp = Array.isArray(leave.employee) ? leave.employee[0] : leave.employee;
    const leaveType = Array.isArray(leave.leave_type) ? leave.leave_type[0] : leave.leave_type;
    return {
      id: leave.id,
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
      employee_initials: emp ? `${emp.first_name[0]}${emp.last_name[0]}` : '??',
      leave_type: leaveType?.name || 'Leave',
      leave_color: leaveType?.color || '#3B82F6',
      start_date: leave.start_date,
      end_date: leave.end_date,
    };
  });

  // Get days for current month view (including padding days from prev/next month)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get leaves for a specific day
  const getLeavesForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return leaveEvents.filter(leave => {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      return isWithinInterval(day, { start, end });
    });
  };

  // Navigate months
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Team Calendar</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-sm font-medium"
              onClick={goToToday}
            >
              {format(currentMonth, 'MMMM yyyy')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div 
              key={day} 
              className="text-center text-xs font-medium text-muted-foreground py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayLeaves = getLeavesForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[60px] p-1 rounded-md border text-xs transition-colors",
                  isCurrentMonth 
                    ? "bg-background border-border" 
                    : "bg-muted/30 border-transparent text-muted-foreground",
                  isCurrentDay && "border-primary bg-primary/5"
                )}
              >
                <div className={cn(
                  "font-medium mb-1",
                  isCurrentDay && "text-primary"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayLeaves.slice(0, 2).map((leave) => (
                    <div
                      key={leave.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: leave.leave_color }}
                      title={`${leave.employee_name} - ${leave.leave_type}`}
                    >
                      {leave.employee_initials}
                    </div>
                  ))}
                  {dayLeaves.length > 2 && (
                    <div className="text-[10px] text-muted-foreground text-center">
                      +{dayLeaves.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {leaveEvents.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Upcoming Absences</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {leaveEvents
                .filter(leave => new Date(leave.end_date) >= new Date())
                .slice(0, 5)
                .map((leave) => (
                  <div 
                    key={leave.id} 
                    className="flex items-center gap-2 text-xs"
                  >
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: leave.leave_color }} 
                    />
                    <span className="font-medium truncate">{leave.employee_name}</span>
                    <span className="text-muted-foreground">
                      {format(parseISO(leave.start_date), 'MMM d')} - {format(parseISO(leave.end_date), 'MMM d')}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 ml-auto">
                      {leave.leave_type}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}

        {leaveEvents.length === 0 && (
          <div className="mt-4 pt-3 border-t text-center text-sm text-muted-foreground">
            No approved team absences scheduled
          </div>
        )}

        {/* View full calendar link */}
        <div className="mt-3 pt-3 border-t flex justify-center">
          <Link to="/app/my-team">
            <Button variant="ghost" size="sm" className="text-xs">
              View Full Team Calendar
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
