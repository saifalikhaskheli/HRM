import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { useTeamLeaveRequests, useLeaveTypes } from '@/hooks/useLeave';
import { useDepartments } from '@/hooks/useDepartments';

export function LeaveCalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  
  const { data: leaveRequests, isLoading } = useTeamLeaveRequests();
  const { data: leaveTypes } = useLeaveTypes();
  const { data: departments } = useDepartments();

  // Filter approved leaves only
  const approvedLeaves = useMemo(() => {
    if (!leaveRequests) return [];
    
    let filtered = leaveRequests.filter(req => req.status === 'approved');
    
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(req => {
        const employee = req.employee as { department?: { id: string } } | null;
        return employee?.department?.id === selectedDepartment;
      });
    }
    
    return filtered;
  }, [leaveRequests, selectedDepartment]);

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get day offset for first day of month
  const startDayOffset = getDay(monthStart);

  // Get leaves for a specific day
  const getLeavesForDay = (day: Date) => {
    return approvedLeaves.filter(leave => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      return day >= start && day <= end;
    });
  };

  const navigatePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const navigateNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Leave Calendar</CardTitle>
            <CardDescription>Visual overview of approved leaves</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments?.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>Today</Button>
          </div>
          <h3 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <div className="w-[100px]" /> {/* Spacer for alignment */}
        </div>

        {/* Calendar Grid */}
        <div className="border rounded-lg overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-muted/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {/* Empty cells for offset */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r bg-muted/20" />
            ))}
            
            {calendarDays.map(day => {
              const dayLeaves = getLeavesForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`min-h-[100px] border-b border-r p-1 ${isToday ? 'bg-primary/5' : ''}`}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayLeaves.slice(0, 3).map(leave => {
                      const leaveType = leave.leave_type as { id: string; name: string; color?: string } | null;
                      const employeeData = leave.employee as unknown;
                      const employee = employeeData as { first_name: string; last_name: string } | null;
                      
                      return (
                        <div
                          key={leave.id}
                          className="text-xs px-1.5 py-0.5 rounded truncate"
                          style={{ 
                            backgroundColor: `${leaveType?.color || '#3B82F6'}20`,
                            color: leaveType?.color || '#3B82F6',
                            borderLeft: `2px solid ${leaveType?.color || '#3B82F6'}`
                          }}
                          title={`${employee?.first_name} ${employee?.last_name} - ${leaveType?.name}`}
                        >
                          {employee?.first_name} {employee?.last_name?.[0]}.
                        </div>
                      );
                    })}
                    {dayLeaves.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayLeaves.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="text-sm text-muted-foreground mr-2">Leave Types:</span>
          {leaveTypes?.map(type => (
            <div key={type.id} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: type.color || '#3B82F6' }}
              />
              <span className="text-sm">{type.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
