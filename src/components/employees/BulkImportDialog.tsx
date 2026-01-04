import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Loader2, Download } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

const employeeRowSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  employee_number: z.string().min(1, 'Employee number is required'),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  job_title: z.string().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern', 'temporary']).default('full_time'),
  employment_status: z.enum(['active', 'on_leave', 'terminated', 'suspended']).default('active'),
  phone: z.string().optional(),
  personal_email: z.string().email().optional().or(z.literal('')),
  work_location: z.string().optional(),
});

type EmployeeRow = z.infer<typeof employeeRowSchema>;

interface ParsedRow {
  rowNumber: number;
  data: Partial<EmployeeRow>;
  errors: string[];
  isValid: boolean;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_CSV_CONTENT = `first_name,last_name,email,employee_number,hire_date,job_title,employment_type,employment_status,phone,personal_email,work_location
John,Doe,john.doe@company.com,EMP-001,2024-01-15,Software Engineer,full_time,active,+1234567890,john@personal.com,New York
Jane,Smith,jane.smith@company.com,EMP-002,2024-02-01,Product Manager,full_time,active,,jane@personal.com,Remote
Bob,Johnson,bob.johnson@company.com,EMP-003,2024-03-10,Designer,part_time,active,+0987654321,,Los Angeles`;

const REQUIRED_COLUMNS = ['first_name', 'last_name', 'email', 'employee_number', 'hire_date'];
const ALL_COLUMNS = ['first_name', 'last_name', 'email', 'employee_number', 'hire_date', 'job_title', 'employment_type', 'employment_status', 'phone', 'personal_email', 'work_location'];

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const { companyId, isFrozen } = useTenant();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [dragOver, setDragOver] = useState(false);

  const resetDialog = useCallback(() => {
    setStep('upload');
    setParsedRows([]);
    setImportResults({ success: 0, failed: 0 });
  }, []);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetDialog, 300);
  };

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employee-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (content: string): ParsedRow[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    // Validate headers
    const missingRequired = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    if (missingRequired.length > 0) {
      toast.error(`Missing required columns: ${missingRequired.join(', ')}`);
      return [];
    }

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const rowData: Partial<EmployeeRow> = {};

      headers.forEach((header, index) => {
        if (ALL_COLUMNS.includes(header) && values[index] !== undefined) {
          const value = values[index].trim().replace(/^"|"$/g, '');
          if (value) {
            (rowData as Record<string, string>)[header] = value;
          }
        }
      });

      // Validate row
      const result = employeeRowSchema.safeParse(rowData);
      const errors: string[] = [];

      if (!result.success) {
        result.error.errors.forEach(err => {
          errors.push(`${err.path.join('.')}: ${err.message}`);
        });
      }

      rows.push({
        rowNumber: i + 1,
        data: rowData,
        errors,
        isValid: errors.length === 0,
      });
    }

    return rows;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const rows = parseCSV(content);
      
      if (rows.length === 0) {
        toast.error('No valid data found in CSV');
        return;
      }

      setParsedRows(rows);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!companyId || isFrozen) return;

    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setStep('importing');
    let success = 0;
    let failed = 0;

    for (const row of validRows) {
      try {
        const { error } = await supabase
          .from('employees')
          .insert({
            company_id: companyId,
            first_name: row.data.first_name!,
            last_name: row.data.last_name!,
            email: row.data.email!,
            employee_number: row.data.employee_number!,
            hire_date: row.data.hire_date!,
            job_title: row.data.job_title || null,
            employment_type: row.data.employment_type || 'full_time',
            employment_status: row.data.employment_status || 'active',
            phone: row.data.phone || null,
            personal_email: row.data.personal_email || null,
            work_location: row.data.work_location || null,
          });

        if (error) {
          failed++;
          console.error('Import error for row', row.rowNumber, error);
        } else {
          success++;
        }
      } catch (err) {
        failed++;
        console.error('Import error for row', row.rowNumber, err);
      }
    }

    setImportResults({ success, failed });
    setStep('complete');
    queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Import Employees</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple employees at once
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="csv-upload"
              />
              <Button variant="outline" asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Select CSV File
                </label>
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Need a template?</p>
                <p className="text-sm text-muted-foreground">
                  Download our sample CSV with the correct format
                </p>
              </div>
              <Button variant="outline" onClick={downloadSampleCSV}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required columns:</strong> first_name, last_name, email, employee_number, hire_date (YYYY-MM-DD)
                <br />
                <strong>Optional:</strong> job_title, employment_type, employment_status, phone, personal_email, work_location
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  <X className="h-3 w-3 mr-1" />
                  {invalidCount} with errors
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Row</TableHead>
                    <TableHead className="w-[60px]">Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Employee #</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow key={row.rowNumber} className={row.isValid ? '' : 'bg-red-50 dark:bg-red-950/20'}>
                      <TableCell className="font-mono text-sm">{row.rowNumber}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>{row.data.first_name} {row.data.last_name}</TableCell>
                      <TableCell>{row.data.email}</TableCell>
                      <TableCell>{row.data.employee_number}</TableCell>
                      <TableCell className="text-sm text-red-600">
                        {row.errors.join('; ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetDialog}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0 || isFrozen}>
                Import {validCount} Employee{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-lg font-medium">Importing employees...</p>
            <p className="text-sm text-muted-foreground">Please wait while we process your data</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-8 text-center space-y-6">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
            <div>
              <p className="text-lg font-medium mb-2">Import Complete</p>
              <div className="flex items-center justify-center gap-4">
                <Badge variant="outline" className="text-green-600 border-green-600">
                  {importResults.success} imported successfully
                </Badge>
                {importResults.failed > 0 && (
                  <Badge variant="outline" className="text-red-600 border-red-600">
                    {importResults.failed} failed
                  </Badge>
                )}
              </div>
            </div>
            <Button onClick={handleClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
