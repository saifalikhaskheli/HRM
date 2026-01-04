import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { usePayrollEntries } from '@/hooks/usePayroll';
import { toast } from 'sonner';
import { exportPayrollToCSV } from '@/lib/export-utils';
import * as XLSX from 'xlsx';

interface PayrollExportButtonProps {
  runId: string;
  runName: string;
}

export function PayrollExportButton({ runId, runName }: PayrollExportButtonProps) {
  const { data: entries, isLoading } = usePayrollEntries(runId);
  const [exporting, setExporting] = useState(false);

  const exportToExcel = () => {
    if (!entries || entries.length === 0) {
      toast.error('No entries to export');
      return;
    }

    setExporting(true);
    try {
      const data = entries.map(entry => ({
        'Employee Name': `${entry.employee?.first_name || ''} ${entry.employee?.last_name || ''}`,
        'Employee Number': entry.employee?.employee_number || '',
        'Job Title': entry.employee?.job_title || '',
        'Base Salary': Number(entry.base_salary),
        'Overtime Pay': Number(entry.overtime_pay || 0),
        'Bonuses': Number(entry.bonuses || 0),
        'Gross Pay': Number(entry.gross_pay),
        'Tax Deductions': Number(entry.tax_deductions || 0),
        'Benefits Deductions': Number(entry.benefits_deductions || 0),
        'Other Deductions': Number(entry.other_deductions || 0),
        'Total Deductions': Number(entry.total_deductions || 0),
        'Net Pay': Number(entry.net_pay),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

      // Auto-size columns
      const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `${runName.replace(/\s+/g, '_')}_payroll.xlsx`);
      toast.success('Excel file downloaded');
    } catch (error) {
      toast.error('Failed to export to Excel');
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = () => {
    if (!entries || entries.length === 0) {
      toast.error('No entries to export');
      return;
    }

    setExporting(true);
    try {
      const formattedEntries = entries.map(entry => ({
        employee: entry.employee 
          ? { 
              first_name: entry.employee.first_name, 
              last_name: entry.employee.last_name,
              employee_number: entry.employee.employee_number 
            }
          : null,
        base_salary: Number(entry.base_salary),
        overtime_pay: Number(entry.overtime_pay || 0),
        bonuses: Number(entry.bonuses || 0),
        gross_pay: Number(entry.gross_pay),
        total_deductions: Number(entry.total_deductions || 0),
        net_pay: Number(entry.net_pay),
      }));

      exportPayrollToCSV(formattedEntries, runName, `${runName.replace(/\s+/g, '_')}_payroll.csv`);
      toast.success('CSV file downloaded');
    } catch (error) {
      toast.error('Failed to export to CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading || exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
