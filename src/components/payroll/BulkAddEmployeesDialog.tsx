import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useEmployees } from '@/hooks/useEmployees';
import { usePayrollRun } from '@/hooks/usePayroll';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Users, AlertTriangle, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { isBankDetailsComplete, type BankDetails } from '@/components/employees/BankDetailsSection';

interface BulkAddEmployeesDialogProps {
  runId: string;
  existingEmployeeIds: string[];
  isLocked: boolean;
}

export function BulkAddEmployeesDialog({ runId, existingEmployeeIds, isLocked }: BulkAddEmployeesDialogProps) {
  const [open, setOpen] = useState(false);
  const { companyId } = useTenant();
  const queryClient = useQueryClient();
  const { data: allEmployees } = useEmployees();
  const { data: payrollRun } = usePayrollRun(runId);

  // Filter to active employees not already in this run
  const eligibleEmployees = allEmployees?.filter(
    emp => emp.employment_status === 'active' && !existingEmployeeIds.includes(emp.id)
  ) || [];

  // Check for missing bank details
  const employeesWithoutBank = eligibleEmployees.filter(
    emp => !isBankDetailsComplete(emp.bank_details as BankDetails)
  );

  const bulkAddMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || eligibleEmployees.length === 0 || !payrollRun) return;

      // Get company PF settings
      const { data: company } = await supabase
        .from('companies')
        .select('pf_enabled, pf_employee_rate')
        .eq('id', companyId)
        .single();

      // Get attendance summaries for the period
      const { data: summaries } = await supabase
        .from('attendance_summaries')
        .select('*')
        .eq('company_id', companyId)
        .eq('period_start', payrollRun.period_start)
        .eq('period_end', payrollRun.period_end);

      const summaryMap = new Map(summaries?.map(s => [s.employee_id, s]) || []);

      // Calculate working days in period
      const periodStart = new Date(payrollRun.period_start);
      const periodEnd = new Date(payrollRun.period_end);
      let workingDays = 0;
      for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) workingDays++;
      }

      // Create entries for all eligible employees with attendance data
      const entries = eligibleEmployees.map(emp => {
        const baseSalary = Number(emp.salary) || 0;
        const dailyRate = workingDays > 0 ? baseSalary / workingDays : 0;
        const summary = summaryMap.get(emp.id);
        
        // Calculate attendance-based adjustments
        const unpaidLeaveDays = Number(summary?.unpaid_leave_days) || 0;
        const overtimeHours = Number(summary?.overtime_hours) || 0;
        const daysPresent = summary?.days_present || 0;
        const daysAbsent = summary?.full_day_absents || 0;
        const daysLate = summary?.days_late || 0;
        const totalHoursWorked = Number(summary?.total_working_hours) || 0;
        const lateMinutes = Number(summary?.late_minutes) || 0;

        // Calculate overtime pay (1.5x hourly rate)
        const hourlyRate = dailyRate / 8;
        const overtimePay = Math.round(hourlyRate * overtimeHours * 1.5 * 100) / 100;

        // Calculate deductions for unpaid leave
        const unpaidLeaveDeduction = Math.round(dailyRate * unpaidLeaveDays * 100) / 100;

        // PF calculation
        let pfDeduction = 0;
        if (company?.pf_enabled) {
          const pfRate = Number(company.pf_employee_rate) || 0;
          pfDeduction = Math.round((baseSalary * pfRate) / 100 * 100) / 100;
        }

        const grossPay = baseSalary + overtimePay;
        const totalDeductions = pfDeduction + unpaidLeaveDeduction;
        const netPay = grossPay - totalDeductions;

        return {
          company_id: companyId,
          payroll_run_id: runId,
          employee_id: emp.id,
          base_salary: baseSalary,
          overtime_pay: overtimePay,
          overtime_hours: overtimeHours,
          bonuses: 0,
          commissions: 0,
          tax_deductions: 0,
          benefits_deductions: unpaidLeaveDeduction,
          pf_deduction: pfDeduction,
          gross_pay: grossPay,
          total_deductions: totalDeductions,
          net_pay: netPay,
          total_employer_cost: grossPay,
          days_present: daysPresent,
          days_absent: daysAbsent,
          days_late: daysLate,
          hours_worked: totalHoursWorked,
          total_late_minutes: lateMinutes,
        };
      });

      const { error } = await supabase
        .from('payroll_entries')
        .insert(entries);

      if (error) throw error;

      // Update run totals
      const { data: allEntries } = await supabase
        .from('payroll_entries')
        .select('gross_pay, net_pay, total_deductions, total_employer_cost')
        .eq('payroll_run_id', runId);

      if (allEntries) {
        const totalGross = allEntries.reduce((sum, e) => sum + Number(e.gross_pay), 0);
        const totalNet = allEntries.reduce((sum, e) => sum + Number(e.net_pay), 0);
        const totalDeductions = allEntries.reduce((sum, e) => sum + Number(e.total_deductions || 0), 0);
        const totalEmployerCost = allEntries.reduce((sum, e) => sum + Number(e.total_employer_cost || 0), 0);

        await supabase
          .from('payroll_runs')
          .update({
            employee_count: allEntries.length,
            total_gross: totalGross,
            total_net: totalNet,
            total_deductions: totalDeductions,
            total_employer_cost: totalEmployerCost,
          })
          .eq('id', runId);
      }

      return eligibleEmployees.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-entries', runId] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast.success(`Added ${count} employees with attendance data`);
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add employees');
    },
  });

  if (isLocked || eligibleEmployees.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Add All Employees
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add All Active Employees</DialogTitle>
          <DialogDescription>
            Add all eligible employees to this payroll run with auto-calculated attendance data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Employees to add</p>
              <p className="text-sm text-muted-foreground">
                Active employees not already in this run
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {eligibleEmployees.length}
            </Badge>
          </div>

          {employeesWithoutBank.length > 0 && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-200">Missing Bank Details</AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                {employeesWithoutBank.length} employee(s) have incomplete bank details. 
                They will be added but may need updates before payment.
              </AlertDescription>
            </Alert>
          )}

          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 text-primary font-medium mb-2">
              <Calculator className="h-4 w-4" />
              <span>Auto-calculated from Attendance</span>
            </div>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Overtime pay (1.5x hourly rate)</li>
              <li>Unpaid leave deductions</li>
              <li>Days present, absent, and late</li>
              <li>Total hours worked</li>
            </ul>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>This will also:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Apply PF deductions if enabled</li>
              <li>Use each employee's base salary</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => bulkAddMutation.mutate()} disabled={bulkAddMutation.isPending}>
            {bulkAddMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add {eligibleEmployees.length} Employees
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
