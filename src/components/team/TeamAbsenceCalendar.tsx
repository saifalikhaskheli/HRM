import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamLeaves } from '@/hooks/useMyTeam';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths, 
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  parseISO
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ViewMode = 'week' | 'month';

export function TeamAbsenceCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const { data: leaves, isLoading } = useTeamLeaves();

  const navigateBack = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, -7));
    }
  };

  const navigateForward = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // Generate calendar days
  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const start = startOfWeek(monthStart, { weekStartsOn: 1 });
      const end = endOfWeek(monthEnd, { weekStartsOn: 1 });

      const days = [];
      let day = start;
      while (day <= end) {
        days.push(day);
        day = addDays(day, 1);
      }
      return days;
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
  }, [currentDate, viewMode]);

  // Get leaves for a specific day
  const getLeavesForDay = (day: Date) => {
    if (!leaves) return [];
    return leaves.filter(leave => {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Team Absence Calendar
            </CardTitle>
            <CardDescription>View approved leaves for your team</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="week" className="text-xs px-2">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigateBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={navigateForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
          <h3 className="font-semibold">
            {viewMode === 'month' 
              ? format(currentDate, 'MMMM yyyy')
              : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
            }
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className={cn(
          "grid grid-cols-7 gap-1",
          viewMode === 'week' ? "min-h-[200px]" : ""
        )}>
          {calendarDays.map((day, idx) => {
            const dayLeaves = getLeavesForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = viewMode === 'week' || isSameMonth(day, currentDate);

            return (
              <div 
                key={idx}
                className={cn(
                  "min-h-[80px] p-1 border rounded-md",
                  isToday && "border-primary bg-primary/5",
                  !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                  viewMode === 'week' && "min-h-[150px]"
                )}
              >
                <div className={cn(
                  "text-sm mb-1",
                  isToday && "font-bold text-primary"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayLeaves.slice(0, viewMode === 'week' ? 5 : 2).map((leave) => {
                    const employee = Array.isArray(leave.employee) ? leave.employee[0] : leave.employee;
                    const leaveType = Array.isArray(leave.leave_type) ? leave.leave_type[0] : leave.leave_type;
                    return (
                      <div 
                        key={leave.id}
                        className="text-xs px-1.5 py-0.5 rounded truncate"
                        style={{ 
                          backgroundColor: `${leaveType?.color || '#3B82F6'}20`,
                          borderLeft: `3px solid ${leaveType?.color || '#3B82F6'}`
                        }}
                        title={`${employee?.first_name} ${employee?.last_name} - ${leaveType?.name}`}
                      >
                        {employee?.first_name} {employee?.last_name?.[0]}.
                      </div>
                    );
                  })}
                  {dayLeaves.length > (viewMode === 'week' ? 5 : 2) && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{dayLeaves.length - (viewMode === 'week' ? 5 : 2)} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {leaves && leaves.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Leave Types:</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(leaves.map(l => {
                const lt = Array.isArray(l.leave_type) ? l.leave_type[0] : l.leave_type;
                return JSON.stringify({ name: lt?.name, color: lt?.color });
              }))).map(json => {
                const { name, color } = JSON.parse(json);
                return (
                  <Badge 
                    key={name} 
                    variant="outline" 
                    className="gap-1"
                    style={{ borderColor: color }}
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    {name}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {(!leaves || leaves.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            No approved leaves found for your team.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
