import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, DollarSign, Lock, Clock, FileText,
  Users, Calculator, Loader2, Eye, Play
} from 'lucide-react';
import { RoleGate } from '@/components/PermissionGate';
import { ModuleGuard } from '@/components/ModuleGuard';
import { PayslipDownloadButton } from '@/components/payroll/PayslipDownloadButton';
import { PayrollExportButton } from '@/components/payroll/PayrollExportButton';
import { PayrollStatusBadge } from '@/components/payroll/PayrollStatusBadge';
import { BulkAddEmployeesDialog } from '@/components/payroll/BulkAddEmployeesDialog';
import { CreatePayrollRunDialog } from '@/components/payroll/CreatePayrollRunDialog';
import { PayrollAttendanceSummary } from '@/components/payroll/PayrollAttendanceSummary';
import { usePayrollRuns, usePayrollEntries, useLockPayrollRun, usePayrollStats, useAddPayrollEntry } from '@/hooks/usePayroll';
import { useEmployees } from '@/hooks/useEmployees';
import { format } from 'date-fns';
import { PayrollStatus } from '@/types/payroll';
import { useLocalization } from '@/contexts/LocalizationContext';

// Removed inline CreateRunDialog - now using extracted component

function PayrollRunDetail({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data: entries, isLoading } = usePayrollEntries(runId);
  const { data: runs } = usePayrollRuns();
  const run = runs?.find(r => r.id === runId);
  const lockRun = useLockPayrollRun();
  const addEntry = useAddPayrollEntry();
  const { data: employees } = useEmployees();
  const { formatCurrency } = useLocalization();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    employee_id: '',
    base_salary: 0,
    overtime_pay: 0,
    bonuses: 0,
    tax_deductions: 0,
    benefits_deductions: 0,
  });

  if (!run) return null;

  const isLocked = run.status === 'completed' || run.status === 'processing';
  const canProcess = run.status === 'draft' && (entries?.length || 0) > 0;
  const canComplete = run.status === 'processing';

  const handleAddEntry = async () => {
    if (!newEntry.employee_id) return;
    await addEntry.mutateAsync({
      payroll_run_id: runId,
      ...newEntry,
    });
    setShowAddEntry(false);
    setNewEntry({ employee_id: '', base_salary: 0, overtime_pay: 0, bonuses: 0, tax_deductions: 0, benefits_deductions: 0 });
  };

  const existingEmployeeIds = entries?.map(e => e.employee_id) || [];
  const availableEmployees = employees?.filter(e => !existingEmployeeIds.includes(e.id)) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{run.name}</h3>
          <p className="text-sm text-muted-foreground">
            Period: {run.period_start} to {run.period_end} | Pay Date: {run.pay_date}
          </p>
        </div>
        <PayrollStatusBadge status={run.status as PayrollStatus} />
      </div>

      {isLocked && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            This payroll run is locked and cannot be modified.
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <PayrollExportButton runId={runId} runName={run.name} />
        {!isLocked && (
          <>
            <Button variant="outline" size="sm" onClick={() => setShowAddEntry(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
            <BulkAddEmployeesDialog
              runId={runId}
              existingEmployeeIds={existingEmployeeIds}
              isLocked={isLocked}
            />
          </>
        )}
        {canProcess && (
          <Button 
            size="sm" 
            onClick={() => lockRun.mutate({ runId, action: 'process' })}
            disabled={lockRun.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            Submit for Processing
          </Button>
        )}
        {canComplete && (
          <Button 
            size="sm" 
            onClick={() => lockRun.mutate({ runId, action: 'complete' })}
            disabled={lockRun.isPending}
          >
            <Lock className="h-4 w-4 mr-2" />
            Complete & Lock
          </Button>
        )}
      </div>

      {showAddEntry && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Payroll Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={newEntry.employee_id} onValueChange={(v) => setNewEntry({ ...newEntry, employee_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Salary</Label>
                <Input
                  type="number"
                  value={newEntry.base_salary}
                  onChange={(e) => setNewEntry({ ...newEntry, base_salary: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Overtime Pay</Label>
                <Input
                  type="number"
                  value={newEntry.overtime_pay}
                  onChange={(e) => setNewEntry({ ...newEntry, overtime_pay: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bonuses</Label>
                <Input
                  type="number"
                  value={newEntry.bonuses}
                  onChange={(e) => setNewEntry({ ...newEntry, bonuses: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax Deductions</Label>
                <Input
                  type="number"
                  value={newEntry.tax_deductions}
                  onChange={(e) => setNewEntry({ ...newEntry, tax_deductions: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddEntry(false)}>Cancel</Button>
              <Button onClick={handleAddEntry} disabled={addEntry.isPending || !newEntry.employee_id}>
                {addEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Summary Section */}
      {entries && entries.length > 0 && (
        <PayrollAttendanceSummary
          runId={runId}
          periodStart={run.period_start}
          periodEnd={run.period_end}
          entries={entries}
          isLocked={isLocked}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries && entries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Base Salary</TableHead>
              <TableHead className="text-right">Overtime</TableHead>
              <TableHead className="text-right">Bonuses</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">
                      {entry.employee?.first_name} {entry.employee?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.employee?.employee_number}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(Number(entry.base_salary))}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(entry.overtime_pay || 0))}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(entry.bonuses || 0))}</TableCell>
                <TableCell className="text-right text-destructive">
                  -{formatCurrency(Number(entry.total_deductions || 0))}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(Number(entry.net_pay))}
                </TableCell>
                <TableCell className="text-right">
                  <PayslipDownloadButton 
                    entryId={entry.id} 
                    employeeName={`${entry.employee?.first_name || ''} ${entry.employee?.last_name || ''}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No entries yet. Add employees to this payroll run.</p>
        </div>
      )}

      {entries && entries.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{entries.length}</p>
                <p className="text-sm text-muted-foreground">Employees</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(entries.reduce((sum, e) => sum + Number(e.gross_pay), 0))}
                </p>
                <p className="text-sm text-muted-foreground">Total Gross</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">
                  {formatCurrency(entries.reduce((sum, e) => sum + Number(e.total_deductions || 0), 0))}
                </p>
                <p className="text-sm text-muted-foreground">Total Deductions</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(entries.reduce((sum, e) => sum + Number(e.net_pay), 0))}
                </p>
                <p className="text-sm text-muted-foreground">Total Net Pay</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PayrollPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runsPage, setRunsPage] = useState(1);
  const RUNS_PAGE_SIZE = 10;
  const { data: runs, isLoading } = usePayrollRuns();
  const { data: stats } = usePayrollStats();
  const { formatCurrency } = useLocalization();

  const paginatedRuns = useMemo(() => {
    if (!runs) return [];
    const start = (runsPage - 1) * RUNS_PAGE_SIZE;
    return runs.slice(start, start + RUNS_PAGE_SIZE);
  }, [runs, runsPage]);

  return (
    <ModuleGuard moduleId="payroll">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payroll</h1>
            <p className="text-muted-foreground">Process and manage payroll runs</p>
          </div>
          <RoleGate role="company_admin">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Payroll Run
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Payroll Run</DialogTitle>
                  <DialogDescription>
                    Create a new payroll run for a specific pay period
                  </DialogDescription>
                </DialogHeader>
                <CreatePayrollRunDialog onClose={() => setCreateDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </RoleGate>
        </div>

      {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRuns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRuns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Last Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.lastPayrollTotal ? formatCurrency(Number(stats.lastPayrollTotal)) : '-'}
              </div>
              {stats.lastPayDate && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(stats.lastPayDate), 'MMM d, yyyy')}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">YTD Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalPaidThisYear)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">Payroll Runs</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <RoleGate role="company_admin">
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </RoleGate>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>Payroll History</CardTitle>
              <CardDescription>View and manage payroll runs</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : runs && runs.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Pay Date</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>Total Net</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRuns.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-medium">{run.name}</TableCell>
                          <TableCell>
                            {format(new Date(run.period_start), 'MMM d')} - {format(new Date(run.period_end), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>{format(new Date(run.pay_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>{run.employee_count || 0}</TableCell>
                          <TableCell>
                            {run.total_net ? formatCurrency(Number(run.total_net)) : '-'}
                          </TableCell>
                          <TableCell>
                            <PayrollStatusBadge status={run.status as PayrollStatus} />
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedRunId(run.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                                <DialogHeader>
                                  <DialogTitle>Payroll Run Details</DialogTitle>
                                </DialogHeader>
                                {selectedRunId === run.id && (
                                  <PayrollRunDetail runId={run.id} onClose={() => setSelectedRunId(null)} />
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    currentPage={runsPage}
                    totalItems={runs?.length || 0}
                    pageSize={RUNS_PAGE_SIZE}
                    onPageChange={setRunsPage}
                  />
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payroll runs yet. Create your first payroll run to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Reports</CardTitle>
              <CardDescription>Generate and download payroll reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="pt-6">
                    <FileText className="h-8 w-8 mb-2 text-primary" />
                    <h3 className="font-semibold">Payroll Summary</h3>
                    <p className="text-sm text-muted-foreground">Monthly payroll totals and trends</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="pt-6">
                    <Users className="h-8 w-8 mb-2 text-primary" />
                    <h3 className="font-semibold">Employee Earnings</h3>
                    <p className="text-sm text-muted-foreground">Individual earnings breakdown</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="pt-6">
                    <Calculator className="h-8 w-8 mb-2 text-primary" />
                    <h3 className="font-semibold">Tax Report</h3>
                    <p className="text-sm text-muted-foreground">Tax deductions and filings</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <RoleGate role="company_admin">
            <Card>
              <CardHeader>
                <CardTitle>Payroll Settings</CardTitle>
                <CardDescription>Configure payroll settings and schedules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Currency</Label>
                    <Select defaultValue="USD">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pay Frequency</Label>
                    <Select defaultValue="monthly">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Immutable Payroll Records</p>
                    <p className="text-sm text-muted-foreground">
                      Once a payroll run is completed, it cannot be modified. This ensures SOC2 compliance and audit integrity.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </RoleGate>
        </TabsContent>
      </Tabs>
      </div>
    </ModuleGuard>
  );
}
