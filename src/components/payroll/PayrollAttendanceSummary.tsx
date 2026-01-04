import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Calendar, CheckCircle2, Loader2, Lock, RefreshCw, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { usePayrollAttendanceSummaries, useGenerateAttendanceSummary } from '@/hooks/useAttendanceSummary';
import { PayrollEntryWithEmployee } from '@/hooks/usePayroll';

interface Props {
  runId: string;
  periodStart: string;
  periodEnd: string;
  entries: PayrollEntryWithEmployee[];
  isLocked?: boolean;
}

export function PayrollAttendanceSummary({ runId, periodStart, periodEnd, entries, isLocked }: Props) {
  const { data: summaries, isLoading, refetch } = usePayrollAttendanceSummaries(runId);
  const generateSummary = useGenerateAttendanceSummary();

  // Calculate working days in period
  const workingDays = useMemo(() => {
    const start = parseISO(periodStart);
    const end = parseISO(periodEnd);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }, [periodStart, periodEnd]);

  // Map summaries to entry employees
  const attendanceData = useMemo(() => {
    if (!entries || !summaries) return [];

    const summaryMap = new Map(summaries.map(s => [s.employee_id, s]));

    return entries.map(entry => {
      const employee = entry.employee;
      if (!employee) return null;

      const summary = summaryMap.get(entry.employee_id);
      
      return {
        employeeId: entry.employee_id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        daysPresent: summary?.days_present || 0,
        daysAbsent: summary?.full_day_absents || 0,
        daysLate: summary?.days_late || 0,
        paidLeaveDays: Number(summary?.paid_leave_days) || 0,
        unpaidLeaveDays: Number(summary?.unpaid_leave_days) || 0,
        totalHours: Number(summary?.total_working_hours) || 0,
        overtimeHours: Number(summary?.overtime_hours) || 0,
        isLocked: summary?.is_locked || false,
        hasSummary: !!summary,
      };
    }).filter(Boolean);
  }, [entries, summaries]);

  // Check for warnings
  const warnings = useMemo(() => {
    const issues: string[] = [];
    
    const missingSummaries = attendanceData.filter(a => !a?.hasSummary).length;
    if (missingSummaries > 0) {
      issues.push(`${missingSummaries} employee(s) have no attendance data`);
    }

    const unpaidLeaveEmployees = attendanceData.filter(a => a && a.unpaidLeaveDays > 0).length;
    if (unpaidLeaveEmployees > 0) {
      issues.push(`${unpaidLeaveEmployees} employee(s) have unpaid leave deductions`);
    }

    return issues;
  }, [attendanceData]);

  const handleRefreshSummaries = async () => {
    await generateSummary.mutateAsync({ periodStart, periodEnd });
    refetch();
  };

  const lockedCount = attendanceData.filter(a => a?.isLocked).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (attendanceData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Summary
              {lockedCount > 0 && (
                <Badge variant="outline" className="ml-2">
                  <Lock className="h-3 w-3 mr-1" />
                  {lockedCount} Locked
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Attendance data for {format(parseISO(periodStart), 'MMM d')} - {format(parseISO(periodEnd), 'MMM d, yyyy')}
            </CardDescription>
          </div>
          {!isLocked && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefreshSummaries}
              disabled={generateSummary.isPending}
            >
              {generateSummary.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Recalculate
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warnings */}
        {warnings.length > 0 && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Attention Required</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-1">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-xl font-bold">{workingDays}</p>
            <p className="text-xs text-muted-foreground">Working Days</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-xl font-bold">{attendanceData.length}</p>
            <p className="text-xs text-muted-foreground">Employees</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-xl font-bold text-amber-600">
              {attendanceData.reduce((sum, a) => sum + (a?.unpaidLeaveDays || 0), 0).toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Unpaid Leave Days</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-xl font-bold text-blue-600">
              {attendanceData.reduce((sum, a) => sum + (a?.overtimeHours || 0), 0).toFixed(1)}h
            </p>
            <p className="text-xs text-muted-foreground">Total Overtime</p>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="max-h-[300px] overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Late</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">Paid Leave</TableHead>
                <TableHead className="text-center">Unpaid Leave</TableHead>
                <TableHead className="text-center">Hours</TableHead>
                <TableHead className="text-center">OT</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceData.map(data => data && (
                <TableRow key={data.employeeId} className={!data.hasSummary ? 'bg-amber-50/50' : ''}>
                  <TableCell className="font-medium">{data.employeeName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {data.daysPresent}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {data.daysLate > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        {data.daysLate}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {data.daysAbsent > 0 ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {data.daysAbsent}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {data.paidLeaveDays > 0 ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {data.paidLeaveDays}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {data.unpaidLeaveDays > 0 ? (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {data.unpaidLeaveDays}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{data.totalHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-center">
                    {data.overtimeHours > 0 ? (
                      <span className="text-blue-600 font-medium">{data.overtimeHours.toFixed(1)}h</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {data.isLocked ? (
                      <span title="Locked for payroll">
                        <Lock className="h-4 w-4 text-green-500 mx-auto" />
                      </span>
                    ) : data.hasSummary ? (
                      <span title="Data available">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      </span>
                    ) : (
                      <span title="No attendance data">
                        <XCircle className="h-4 w-4 text-amber-500 mx-auto" />
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
