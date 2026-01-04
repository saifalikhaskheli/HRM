import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

type DateRange = 'last7' | 'last30' | 'thisMonth' | 'lastMonth';

interface TimeEntry {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number | null;
  total_hours: number | null;
  overtime_hours: number | null;
  is_approved: boolean | null;
  employee: {
    employee_number: string;
    first_name: string;
    last_name: string;
  };
}

export function AttendanceExportButton() {
  const { companyId } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const getDateRange = (range: DateRange): { start: Date; end: Date } => {
    const today = new Date();
    switch (range) {
      case 'last7':
        return { start: subDays(today, 7), end: today };
      case 'last30':
        return { start: subDays(today, 30), end: today };
      case 'thisMonth':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'lastMonth':
        const lastMonth = subDays(startOfMonth(today), 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
  };

  const exportData = async (range: DateRange, fileFormat: 'xlsx' | 'csv') => {
    if (!companyId) return;
    
    setIsExporting(true);
    try {
      const { start, end } = getDateRange(range);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const { data: entries, error } = await supabase
        .from('time_entries')
        .select(`
          id,
          date,
          clock_in,
          clock_out,
          break_minutes,
          total_hours,
          overtime_hours,
          is_approved,
          employee:employees!inner(employee_number, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: false })
        .order('employee_id');

      if (error) throw error;

      if (!entries || entries.length === 0) {
        toast.info('No attendance data found for the selected period');
        return;
      }

      const exportRows = (entries as unknown as TimeEntry[]).map(entry => ({
        'Employee Number': entry.employee.employee_number,
        'Employee Name': `${entry.employee.first_name} ${entry.employee.last_name}`,
        'Date': entry.date,
        'Clock In': entry.clock_in ? format(new Date(entry.clock_in), 'HH:mm') : '',
        'Clock Out': entry.clock_out ? format(new Date(entry.clock_out), 'HH:mm') : '',
        'Break (mins)': entry.break_minutes || 0,
        'Total Hours': entry.total_hours?.toFixed(2) || '',
        'Overtime Hours': entry.overtime_hours?.toFixed(2) || '',
        'Status': entry.is_approved ? 'Approved' : 'Pending',
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Employee Number
        { wch: 25 }, // Employee Name
        { wch: 12 }, // Date
        { wch: 10 }, // Clock In
        { wch: 10 }, // Clock Out
        { wch: 12 }, // Break
        { wch: 12 }, // Total Hours
        { wch: 14 }, // Overtime
        { wch: 10 }, // Status
      ];

      const filename = `attendance-${startStr}-to-${endStr}.${fileFormat}`;
      
      if (fileFormat === 'csv') {
        XLSX.writeFile(wb, filename, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, filename);
      }

      toast.success(`Exported ${entries.length} records`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export attendance data');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Employee Number': 'EMP-001',
        'Date': format(new Date(), 'yyyy-MM-dd'),
        'Clock In': '09:00',
        'Clock Out': '18:00',
        'Break (mins)': 60,
      },
      {
        'Employee Number': 'EMP-002',
        'Date': format(new Date(), 'yyyy-MM-dd'),
        'Clock In': '08:30',
        'Clock Out': '17:30',
        'Break (mins)': 45,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    ws['!cols'] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
    ];

    XLSX.writeFile(wb, 'attendance-import-template.xlsx');
    toast.success('Template downloaded');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export as Excel</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportData('last7', 'xlsx')}>
          Last 7 days
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportData('last30', 'xlsx')}>
          Last 30 days
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportData('thisMonth', 'xlsx')}>
          This month
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportData('lastMonth', 'xlsx')}>
          Last month
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export as CSV</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportData('last30', 'csv')}>
          Last 30 days (CSV)
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={downloadTemplate}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Download Template
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
