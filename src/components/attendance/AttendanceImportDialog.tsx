import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useEmployees } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, parse, differenceInMinutes } from 'date-fns';

interface AttendanceRow {
  employeeNumber: string;
  employeeName?: string;
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  totalHours: number;
  status: 'valid' | 'invalid' | 'not_found';
  error?: string;
  employeeId?: string;
}

interface AttendanceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttendanceImportDialog({ open, onOpenChange }: AttendanceImportDialogProps) {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();
  const { data: employees = [] } = useEmployees();
  const [parsedData, setParsedData] = useState<AttendanceRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');

  const importMutation = useMutation({
    mutationFn: async (rows: AttendanceRow[]) => {
      if (!companyId) throw new Error('No company selected');
      
      const validRows = rows.filter(r => r.status === 'valid' && r.employeeId);
      
      const entries = validRows.map(row => ({
        company_id: companyId,
        employee_id: row.employeeId!,
        date: row.date,
        clock_in: row.clockIn ? `${row.date}T${row.clockIn}:00` : null,
        clock_out: row.clockOut ? `${row.date}T${row.clockOut}:00` : null,
        break_minutes: row.breakMinutes,
        total_hours: row.totalHours,
        is_approved: false,
      }));

      // Use upsert to handle duplicates
      const { error } = await supabase
        .from('time_entries')
        .upsert(entries, { 
          onConflict: 'company_id,employee_id,date',
          ignoreDuplicates: false 
        });

      if (error) throw error;
      return validRows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success(`Imported ${count} attendance records`);
      setStep('complete');
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][];

        // Expect headers: Employee Number, Date, Clock In, Clock Out, Break (mins)
        const rows: AttendanceRow[] = [];
        
        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length < 4) continue;

          const employeeNumber = String(row[0]).trim();
          const rawDate = row[1];
          const clockIn = String(row[2] || '').trim();
          const clockOut = String(row[3] || '').trim();
          const breakMinutes = Number(row[4]) || 0;

          // Parse date
          let dateStr = '';
          if (typeof rawDate === 'number') {
            // Excel date serial
            const excelDate = XLSX.SSF.parse_date_code(rawDate);
            dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
          } else if (typeof rawDate === 'string') {
            // Try common formats
            const parsed = parse(rawDate, 'yyyy-MM-dd', new Date());
            if (!isNaN(parsed.getTime())) {
              dateStr = format(parsed, 'yyyy-MM-dd');
            } else {
              const parsed2 = parse(rawDate, 'dd/MM/yyyy', new Date());
              if (!isNaN(parsed2.getTime())) {
                dateStr = format(parsed2, 'yyyy-MM-dd');
              }
            }
          }

          // Calculate hours
          let totalHours = 0;
          if (clockIn && clockOut) {
            try {
              const inTime = parse(clockIn, 'HH:mm', new Date());
              const outTime = parse(clockOut, 'HH:mm', new Date());
              const totalMinutes = differenceInMinutes(outTime, inTime) - breakMinutes;
              totalHours = Math.round((totalMinutes / 60) * 100) / 100;
            } catch {
              // Invalid time format
            }
          }

          // Find employee
          const employee = employees.find(emp => emp.employee_number === employeeNumber);
          
          let status: AttendanceRow['status'] = 'valid';
          let error: string | undefined;

          if (!dateStr) {
            status = 'invalid';
            error = 'Invalid date format';
          } else if (!employee) {
            status = 'not_found';
            error = 'Employee not found';
          } else if (!clockIn || !clockOut) {
            status = 'invalid';
            error = 'Missing clock in/out time';
          }

          rows.push({
            employeeNumber,
            employeeName: employee ? `${employee.first_name} ${employee.last_name}` : undefined,
            date: dateStr,
            clockIn,
            clockOut,
            breakMinutes,
            totalHours,
            status,
            error,
            employeeId: employee?.id,
          });
        }

        setParsedData(rows);
        setFileName(file.name);
        setStep('preview');
      } catch (error) {
        toast.error('Failed to parse file');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleImport = () => {
    importMutation.mutate(parsedData);
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName('');
    setStep('upload');
    onOpenChange(false);
  };

  const validCount = parsedData.filter(r => r.status === 'valid').length;
  const invalidCount = parsedData.filter(r => r.status !== 'valid').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Attendance Data
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with attendance records
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Expected columns: Employee Number, Date, Clock In (HH:mm), Clock Out (HH:mm), Break (mins)
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary font-medium">Click to upload</span>
                <span className="text-muted-foreground"> or drag and drop</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-2">CSV, XLS, or XLSX files</p>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                File: {fileName}
              </p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">{validCount} valid</span>
                {invalidCount > 0 && (
                  <span className="text-destructive">{invalidCount} invalid</span>
                )}
              </div>
            </div>

            <div className="border rounded-lg max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Employee #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, i) => (
                    <TableRow key={i} className={row.status !== 'valid' ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {row.status === 'valid' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-xs text-destructive">{row.error}</span>
                        )}
                      </TableCell>
                      <TableCell>{row.employeeNumber}</TableCell>
                      <TableCell>{row.employeeName || '-'}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.clockIn}</TableCell>
                      <TableCell>{row.clockOut}</TableCell>
                      <TableCell>{row.breakMinutes}m</TableCell>
                      <TableCell>{row.totalHours.toFixed(2)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? 'Importing...' : `Import ${validCount} Records`}
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
            <p className="text-muted-foreground mb-4">
              Successfully imported {validCount} attendance records
            </p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
