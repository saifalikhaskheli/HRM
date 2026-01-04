import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Clock, Play, Square, CheckCircle2, Loader2, Calendar, AlertCircle, Coffee, MapPin, Timer, X, CheckCheck, Upload } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadMoreButton } from '@/components/ui/table-pagination';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { WriteGate } from '@/components/PermissionGate';
import { ModuleGuard } from '@/components/ModuleGuard';
import { useUserRole } from '@/hooks/useUserRole';
import { useTenant } from '@/contexts/TenantContext';
import { TimeCorrectionDialog } from '@/components/time/TimeCorrectionDialog';
import { TimeCorrectionRequestsPanel } from '@/components/time/TimeCorrectionRequestsPanel';
import { MyCorrectionRequestsTab } from '@/components/time/MyCorrectionRequestsTab';
import { usePendingTimeCorrectionRequests, useMyTimeCorrectionRequests } from '@/hooks/useTimeCorrectionRequests';
import { 
  useTodayEntry, 
  useClockIn, 
  useClockOut, 
  useTimeSummary, 
  useMyTimeEntries,
  useTeamTimeEntries,
  useApproveTimeEntry,
  useRejectTimeEntry,
  useBulkApproveTimeEntries,
  useActiveBreak,
  useStartBreak,
  useEndBreak,
  useTotalBreakDuration,
  getClockStatus,
  ClockStatus,
  GeoLocation
} from '@/hooks/useTimeTracking';
import { AttendanceReportCard } from '@/components/attendance/AttendanceReportCard';
import { AttendanceImportDialog } from '@/components/attendance/AttendanceImportDialog';
import { AttendanceExportButton } from '@/components/attendance/AttendanceExportButton';
import { WorkScheduleConfiguration } from '@/components/settings/WorkScheduleConfiguration';

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / 1000);
  
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function LocationBadge({ location }: { location: GeoLocation | null }) {
  if (!location) return null;
  
  const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a 
            href={mapsUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <MapPin className="h-3 w-3" />
            View
          </a>
        </TooltipTrigger>
        <TooltipContent>
          <p>Lat: {location.latitude.toFixed(4)}</p>
          <p>Lng: {location.longitude.toFixed(4)}</p>
          {location.accuracy && <p>Accuracy: ±{Math.round(location.accuracy)}m</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getStatusConfig(status: ClockStatus) {
  switch (status) {
    case 'clocked_in':
      return {
        label: 'Currently Working',
        color: 'bg-green-500/20 text-green-600',
        borderColor: 'border-green-500/50 bg-green-500/5',
        buttonLabel: 'Clock Out',
        buttonVariant: 'destructive' as const,
        buttonIcon: Square,
      };
    case 'on_break':
      return {
        label: 'On Break',
        color: 'bg-amber-500/20 text-amber-600',
        borderColor: 'border-amber-500/50 bg-amber-500/5',
        buttonLabel: 'Clock Out',
        buttonVariant: 'destructive' as const,
        buttonIcon: Square,
      };
    case 'clocked_out':
      return {
        label: 'Completed for Today',
        color: 'bg-blue-500/20 text-blue-600',
        borderColor: 'border-blue-500/50 bg-blue-500/5',
        buttonLabel: 'Day Complete',
        buttonVariant: 'secondary' as const,
        buttonIcon: CheckCircle2,
      };
    default:
      return {
        label: 'Not Started',
        color: 'bg-muted text-muted-foreground',
        borderColor: '',
        buttonLabel: 'Clock In',
        buttonVariant: 'default' as const,
        buttonIcon: Play,
      };
  }
}

export default function TimePage() {
  const { employeeId } = useTenant();
  const { isHROrAbove, isManager } = useUserRole();
  const { data: todayEntry, isLoading: todayLoading } = useTodayEntry();
  const { data: activeBreak } = useActiveBreak();
  const { todayHours, weekHours, monthHours, weekOvertime } = useTimeSummary();
  const { totalMinutes: breakMinutes, breakCount } = useTotalBreakDuration();
  const { data: myEntries = [], isLoading: entriesLoading } = useMyTimeEntries();
  const { data: teamEntries = [], isLoading: teamLoading } = useTeamTimeEntries();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const approveEntry = useApproveTimeEntry();
  const rejectEntry = useRejectTimeEntry();
  const bulkApprove = useBulkApproveTimeEntries();
  const { data: correctionRequests = [] } = usePendingTimeCorrectionRequests();
  const { data: myCorrectionRequests = [] } = useMyTimeCorrectionRequests();
  
  const [activeTab, setActiveTab] = useState('my');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [breakElapsed, setBreakElapsed] = useState('00:00');
  const [entriesDisplayCount, setEntriesDisplayCount] = useState(20);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const clockStatus = getClockStatus(todayEntry, activeBreak);
  const statusConfig = getStatusConfig(clockStatus);
  const hasEmployeeRecord = !!employeeId;
  const isActionDisabled = clockIn.isPending || clockOut.isPending || todayLoading || !hasEmployeeRecord;
  const isBreakDisabled = startBreak.isPending || endBreak.isPending || !hasEmployeeRecord;

  // Live timer effect for work time
  useEffect(() => {
    if ((clockStatus !== 'clocked_in' && clockStatus !== 'on_break') || !todayEntry?.clock_in) {
      setElapsedTime('00:00:00');
      return;
    }

    setElapsedTime(formatElapsedTime(todayEntry.clock_in));

    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(todayEntry.clock_in!));
    }, 1000);

    return () => clearInterval(interval);
  }, [clockStatus, todayEntry?.clock_in]);

  // Live timer for active break
  useEffect(() => {
    if (!activeBreak?.break_start) {
      setBreakElapsed('00:00');
      return;
    }

    const updateBreakTime = () => {
      const start = new Date(activeBreak.break_start).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      setBreakElapsed(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    updateBreakTime();
    const interval = setInterval(updateBreakTime, 1000);
    return () => clearInterval(interval);
  }, [activeBreak?.break_start]);

  const handleClockAction = () => {
    if (clockStatus === 'clocked_out') return;
    
    if (clockStatus === 'clocked_in' || clockStatus === 'on_break') {
      clockOut.mutate();
    } else {
      clockIn.mutate();
    }
  };

  const handleBreakAction = () => {
    if (clockStatus === 'on_break') {
      endBreak.mutate();
    } else {
      startBreak.mutate();
    }
  };

  const pendingApprovals = teamEntries.filter(e => !e.is_approved && e.total_hours);

  const actions = (
    <div className="flex items-center gap-2">
      <WriteGate>
        <TimeCorrectionDialog />
      </WriteGate>
      
      {/* Break Button - Only show when clocked in */}
      {(clockStatus === 'clocked_in' || clockStatus === 'on_break') && (
        <WriteGate>
          <Button
            onClick={handleBreakAction}
            disabled={isBreakDisabled}
            variant={clockStatus === 'on_break' ? 'default' : 'outline'}
            size="lg"
          >
            {(startBreak.isPending || endBreak.isPending) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Coffee className="h-4 w-4 mr-2" />
            )}
            {clockStatus === 'on_break' ? 'End Break' : 'Start Break'}
          </Button>
        </WriteGate>
      )}

      <WriteGate>
        <Button 
          onClick={handleClockAction}
          disabled={isActionDisabled || clockStatus === 'clocked_out'}
          variant={statusConfig.buttonVariant}
          size="lg"
        >
          {(clockIn.isPending || clockOut.isPending) ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <statusConfig.buttonIcon className="h-4 w-4 mr-2" />
          )}
          {statusConfig.buttonLabel}
        </Button>
      </WriteGate>
    </div>
  );

  return (
    <ModuleGuard moduleId="time_tracking">
      <PageContainer>
        <PageHeader 
          title="Time Tracking" 
          description="Track your work hours and attendance"
          actions={actions}
        />

        {/* No Employee Record Warning */}
        {!hasEmployeeRecord && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Employee Record Found</AlertTitle>
            <AlertDescription>
              Your user account is not linked to an employee record. Please contact your HR administrator.
            </AlertDescription>
          </Alert>
        )}

        {/* Current Status Card */}
        <Card className={statusConfig.borderColor}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${statusConfig.color}`}>
                  {clockStatus === 'on_break' ? <Coffee className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-medium">{statusConfig.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {todayEntry?.clock_in ? (
                      <>
                        Clocked in at {format(new Date(todayEntry.clock_in), 'h:mm a')}
                        {todayEntry.clock_out && ` • Clocked out at ${format(new Date(todayEntry.clock_out), 'h:mm a')}`}
                      </>
                    ) : (
                      'No activity recorded today'
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {clockStatus === 'on_break' ? (
                  <>
                    <p className="text-2xl font-bold font-mono text-amber-600">{breakElapsed}</p>
                    <p className="text-xs text-muted-foreground">Break time</p>
                  </>
                ) : (clockStatus === 'clocked_in') ? (
                  <>
                    <p className="text-2xl font-bold font-mono text-green-600">{elapsedTime}</p>
                    <p className="text-xs text-muted-foreground">Time elapsed</p>
                  </>
                ) : todayEntry?.total_hours ? (
                  <>
                    <p className="text-2xl font-bold">{formatHours(todayEntry.total_hours)}</p>
                    <p className="text-xs text-muted-foreground">Today's total</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-muted-foreground">--:--</p>
                    <p className="text-xs text-muted-foreground">Not started</p>
                  </>
                )}
              </div>
            </div>

            {/* Break Summary - Show when there are breaks */}
            {breakCount > 0 && (
              <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4" />
                  <span>{breakCount} break{breakCount > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  <span>Total: {formatMinutes(breakMinutes)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today</CardDescription>
              <CardTitle className="text-2xl">{formatHours(todayHours)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Week</CardDescription>
              <CardTitle className="text-2xl">{formatHours(weekHours)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Month</CardDescription>
              <CardTitle className="text-2xl">{formatHours(monthHours)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={weekOvertime > 0 ? 'border-orange-500/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription>Week Overtime</CardDescription>
              <CardTitle className={`text-2xl ${weekOvertime > 0 ? 'text-orange-600' : ''}`}>
                {formatHours(weekOvertime)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="my">My Entries</TabsTrigger>
            <TabsTrigger value="my-requests">
              My Requests
              {myCorrectionRequests.filter(r => r.status === 'pending' || r.status === 'clarification_needed').length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {myCorrectionRequests.filter(r => r.status === 'pending' || r.status === 'clarification_needed').length}
                </Badge>
              )}
            </TabsTrigger>
            {(isHROrAbove || isManager) && (
              <TabsTrigger value="team">
                Team Entries
                {pendingApprovals.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{pendingApprovals.length}</Badge>
                )}
              </TabsTrigger>
            )}
            {(isHROrAbove || isManager) && (
              <TabsTrigger value="corrections">
                Corrections
                {correctionRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{correctionRequests.length}</Badge>
                )}
              </TabsTrigger>
            )}
            {isHROrAbove && (
              <>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="settings">Schedule</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="my" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>My Time Entries</CardTitle>
                <CardDescription>Your recent time entries</CardDescription>
              </CardHeader>
              <CardContent>
                {entriesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : myEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No time entries recorded yet.</p>
                    <p className="text-sm mt-1">Clock in to start tracking your time.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Clock In</TableHead>
                            <TableHead>Clock Out</TableHead>
                            <TableHead>Break</TableHead>
                            <TableHead>Hours</TableHead>
                            <TableHead>Overtime</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {myEntries.slice(0, entriesDisplayCount).map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">
                                {format(new Date(entry.date), 'EEE, MMM d')}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span>{entry.clock_in ? format(new Date(entry.clock_in), 'h:mm a') : '-'}</span>
                                  {entry.clock_in_location && (
                                    <LocationBadge location={entry.clock_in_location as unknown as GeoLocation} />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span>{entry.clock_out ? format(new Date(entry.clock_out), 'h:mm a') : '-'}</span>
                                  {entry.clock_out_location && (
                                    <LocationBadge location={entry.clock_out_location as unknown as GeoLocation} />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {entry.break_minutes ? `${entry.break_minutes}m` : '-'}
                              </TableCell>
                              <TableCell>
                                {entry.total_hours ? formatHours(entry.total_hours) : '-'}
                              </TableCell>
                              <TableCell>
                                {entry.overtime_hours && entry.overtime_hours > 0 ? (
                                  <span className="text-orange-600">{formatHours(entry.overtime_hours)}</span>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {entry.is_approved ? (
                                  <Badge variant="default">Approved</Badge>
                                ) : entry.total_hours ? (
                                  <Badge variant="secondary">Pending</Badge>
                                ) : (
                                  <Badge variant="outline">In Progress</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {myEntries.length > entriesDisplayCount && (
                      <LoadMoreButton
                        onLoadMore={() => setEntriesDisplayCount(prev => prev + 20)}
                        currentCount={entriesDisplayCount}
                        totalCount={myEntries.length}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-requests" className="mt-4">
            <MyCorrectionRequestsTab />
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Team Time Entries</CardTitle>
                  <CardDescription>Review and approve team time entries</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedEntries.size > 0 && (
                    <Button
                      onClick={() => {
                        bulkApprove.mutate(Array.from(selectedEntries), {
                          onSuccess: () => setSelectedEntries(new Set()),
                        });
                      }}
                      disabled={bulkApprove.isPending}
                    >
                      {bulkApprove.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCheck className="h-4 w-4 mr-2" />
                      )}
                      Approve Selected ({selectedEntries.size})
                    </Button>
                  )}
                  <WriteGate>
                    <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <AttendanceExportButton />
                  </WriteGate>
                </div>
              </CardHeader>
              <CardContent>
                {teamLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : teamEntries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No team entries found.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={
                                pendingApprovals.length > 0 &&
                                pendingApprovals.every(e => selectedEntries.has(e.id))
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedEntries(new Set(pendingApprovals.map(e => e.id)));
                                } else {
                                  setSelectedEntries(new Set());
                                }
                              }}
                              disabled={pendingApprovals.length === 0}
                            />
                          </TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Clock In/Out</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamEntries.map((entry) => {
                          const isPending = !entry.is_approved && entry.total_hours;
                          return (
                            <TableRow key={entry.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedEntries.has(entry.id)}
                                  onCheckedChange={(checked) => {
                                    const newSet = new Set(selectedEntries);
                                    if (checked) {
                                      newSet.add(entry.id);
                                    } else {
                                      newSet.delete(entry.id);
                                    }
                                    setSelectedEntries(newSet);
                                  }}
                                  disabled={!isPending}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {(entry as any).employee?.first_name} {(entry as any).employee?.last_name}
                              </TableCell>
                              <TableCell>{format(new Date(entry.date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>
                                {entry.clock_in ? format(new Date(entry.clock_in), 'h:mm a') : '-'}
                                {' - '}
                                {entry.clock_out ? format(new Date(entry.clock_out), 'h:mm a') : '-'}
                              </TableCell>
                              <TableCell>{entry.total_hours ? formatHours(entry.total_hours) : '-'}</TableCell>
                              <TableCell>
                                {entry.is_approved ? (
                                  <Badge variant="default">Approved</Badge>
                                ) : (
                                  <Badge variant="secondary">Pending</Badge>
                                )}
                              </TableCell>
                              <TableCell className="flex gap-2">
                                {isPending && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => approveEntry.mutate(entry.id)}
                                      disabled={approveEntry.isPending || rejectEntry.isPending}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => {
                                        const reason = window.prompt('Enter rejection reason:');
                                        if (reason) {
                                          rejectEntry.mutate({ entryId: entry.id, reason });
                                        }
                                      }}
                                      disabled={approveEntry.isPending || rejectEntry.isPending}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {entry.notes && !entry.is_approved && (
                                  <span className="text-xs text-destructive">Rejected: {entry.notes}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="corrections" className="mt-4">
            <TimeCorrectionRequestsPanel />
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <AttendanceReportCard />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <WorkScheduleConfiguration />
          </TabsContent>
        </Tabs>

        <AttendanceImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      </PageContainer>
    </ModuleGuard>
  );
}
