import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, Clock } from 'lucide-react';
import { useCompanySchedule, useSaveCompanySchedule, useDefaultSchedule, getDayName, WorkSchedule } from '@/hooks/useWorkSchedules';
import { useDepartments } from '@/hooks/useDepartments';

interface ScheduleFormData {
  day_of_week: number;
  is_working_day: boolean;
  expected_start: string;
  expected_end: string;
  expected_hours: number;
  break_minutes: number;
}

export function WorkScheduleConfiguration() {
  const { data: existingSchedule, isLoading } = useCompanySchedule();
  const saveSchedule = useSaveCompanySchedule();
  const defaultSchedule = useDefaultSchedule();
  const { data: departments } = useDepartments();
  
  const [schedules, setSchedules] = useState<ScheduleFormData[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('company');

  // Initialize with existing or default schedule
  useEffect(() => {
    if (existingSchedule && existingSchedule.length > 0) {
      setSchedules(existingSchedule.map(s => ({
        day_of_week: s.day_of_week,
        is_working_day: s.is_working_day,
        expected_start: s.expected_start,
        expected_end: s.expected_end,
        expected_hours: s.expected_hours,
        break_minutes: s.break_minutes,
      })));
    } else {
      setSchedules(defaultSchedule.map(s => ({
        day_of_week: s.day_of_week,
        is_working_day: s.is_working_day,
        expected_start: s.expected_start,
        expected_end: s.expected_end,
        expected_hours: s.expected_hours,
        break_minutes: s.break_minutes,
      })));
    }
  }, [existingSchedule, defaultSchedule]);

  const updateSchedule = (dayOfWeek: number, field: keyof ScheduleFormData, value: any) => {
    setSchedules(prev => prev.map(s => 
      s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s
    ));
  };

  const handleSave = () => {
    saveSchedule.mutate(schedules.map(s => ({
      ...s,
      employee_id: null, // Company-wide schedule
    })));
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    // Handle both HH:mm:ss and HH:mm formats
    const [hours, minutes] = time.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

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
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Work Schedule Configuration
            </CardTitle>
            <CardDescription>
              Define standard working hours for attendance tracking and late detection
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company-wide Default</SelectItem>
                {departments?.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selectedDepartment !== 'company' && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            Department-specific schedules override company-wide defaults for employees in that department.
          </div>
        )}
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Day</TableHead>
              <TableHead className="w-[100px]">Working Day</TableHead>
              <TableHead className="w-[140px]">Start Time</TableHead>
              <TableHead className="w-[140px]">End Time</TableHead>
              <TableHead className="w-[120px]">Expected Hours</TableHead>
              <TableHead className="w-[120px]">Break (mins)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.sort((a, b) => a.day_of_week - b.day_of_week).map(schedule => (
              <TableRow key={schedule.day_of_week} className={!schedule.is_working_day ? 'opacity-50' : ''}>
                <TableCell className="font-medium">
                  {getDayName(schedule.day_of_week)}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={schedule.is_working_day}
                    onCheckedChange={(checked) => updateSchedule(schedule.day_of_week, 'is_working_day', checked)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="time"
                    value={formatTime(schedule.expected_start)}
                    onChange={(e) => updateSchedule(schedule.day_of_week, 'expected_start', e.target.value + ':00')}
                    disabled={!schedule.is_working_day}
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="time"
                    value={formatTime(schedule.expected_end)}
                    onChange={(e) => updateSchedule(schedule.day_of_week, 'expected_end', e.target.value + ':00')}
                    disabled={!schedule.is_working_day}
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={schedule.expected_hours}
                    onChange={(e) => updateSchedule(schedule.day_of_week, 'expected_hours', parseFloat(e.target.value) || 0)}
                    disabled={!schedule.is_working_day}
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    step="15"
                    value={schedule.break_minutes}
                    onChange={(e) => updateSchedule(schedule.day_of_week, 'break_minutes', parseInt(e.target.value) || 0)}
                    disabled={!schedule.is_working_day}
                    className="w-full"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saveSchedule.isPending}>
            {saveSchedule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
