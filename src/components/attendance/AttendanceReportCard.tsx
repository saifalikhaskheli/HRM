import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, isWeekend } from 'date-fns';
import { useTeamTimeEntries } from '@/hooks/useTimeTracking';
import { useDepartments } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { convertToCSV, downloadFile } from '@/lib/export-utils';

interface EmployeeAttendanceSummary {
  employeeId: string;
  employeeName: string;
  department: string;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  totalHours: number;
  workingDays: number;
  attendanceRate: number;
}

export function AttendanceReportCard() {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployees();
  
  // Parse selected month
  const [year, month] = selectedMonth.split('-').map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(monthStart);
  
  const { data: timeEntries, isLoading } = useTeamTimeEntries(
    format(monthStart, 'yyyy-MM-dd'),
    format(monthEnd, 'yyyy-MM-dd')
  );

  // Calculate working days in the month (excluding weekends)
  const workingDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.filter(day => !isWeekend(day)).length;
  }, [monthStart, monthEnd]);

  // Calculate attendance summary per employee
  const attendanceSummary = useMemo((): EmployeeAttendanceSummary[] => {
    if (!employees || !timeEntries) return [];
    
    let filteredEmployees = employees.filter(e => e.employment_status === 'active');
    
    if (selectedDepartment !== 'all') {
      filteredEmployees = filteredEmployees.filter(e => e.department_id === selectedDepartment);
    }
    
    return filteredEmployees.map(employee => {
      const employeeEntries = timeEntries.filter(e => e.employee_id === employee.id);
      
      const presentDays = employeeEntries.filter(e => e.total_hours && e.total_hours > 0).length;
      const lateDays = employeeEntries.filter(e => (e.late_minutes || 0) > 0).length;
      const totalHours = employeeEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
      const absentDays = workingDays - presentDays;
      const attendanceRate = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;
      
      const dept = departments?.find(d => d.id === employee.department_id);
      
      return {
        employeeId: employee.id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        department: dept?.name || 'Unassigned',
        presentDays,
        lateDays,
        absentDays: Math.max(0, absentDays),
        totalHours: Math.round(totalHours * 10) / 10,
        workingDays,
        attendanceRate: Math.round(attendanceRate),
      };
    });
  }, [employees, timeEntries, departments, selectedDepartment, workingDays]);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  // Export to CSV
  const handleExport = () => {
    const csvContent = convertToCSV(attendanceSummary as unknown as Record<string, unknown>[], [
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'department', label: 'Department' },
      { key: 'presentDays', label: 'Present Days', format: (v) => String(v) },
      { key: 'lateDays', label: 'Late Days', format: (v) => String(v) },
      { key: 'absentDays', label: 'Absent Days', format: (v) => String(v) },
      { key: 'totalHours', label: 'Total Hours', format: (v) => String(v) },
      { key: 'attendanceRate', label: 'Attendance Rate (%)', format: (v) => String(v) },
    ]);
    
    downloadFile(csvContent, `attendance-report-${selectedMonth}.csv`);
  };

  // Calculate totals
  const totals = useMemo(() => {
    return {
      totalEmployees: attendanceSummary.length,
      avgAttendance: attendanceSummary.length > 0 
        ? Math.round(attendanceSummary.reduce((sum, e) => sum + e.attendanceRate, 0) / attendanceSummary.length)
        : 0,
      totalLate: attendanceSummary.reduce((sum, e) => sum + e.lateDays, 0),
    };
  }, [attendanceSummary]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Attendance Report</CardTitle>
            <CardDescription>Monthly attendance summary by employee</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button variant="outline" onClick={handleExport} disabled={attendanceSummary.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{totals.totalEmployees}</p>
            <p className="text-sm text-muted-foreground">Total Employees</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{workingDays}</p>
            <p className="text-sm text-muted-foreground">Working Days</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{totals.avgAttendance}%</p>
            <p className="text-sm text-muted-foreground">Avg Attendance</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-amber-600">{totals.totalLate}</p>
            <p className="text-sm text-muted-foreground">Late Instances</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : attendanceSummary.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No attendance data for this period.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Late</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">Total Hours</TableHead>
                <TableHead className="text-center">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceSummary.map(summary => (
                <TableRow key={summary.employeeId}>
                  <TableCell className="font-medium">{summary.employeeName}</TableCell>
                  <TableCell>{summary.department}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {summary.presentDays}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {summary.lateDays > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        {summary.lateDays}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {summary.absentDays > 0 ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {summary.absentDays}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{summary.totalHours}h</TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={
                        summary.attendanceRate >= 90 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : summary.attendanceRate >= 75 
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                      }
                    >
                      {summary.attendanceRate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
