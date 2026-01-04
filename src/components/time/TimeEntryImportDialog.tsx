import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useEmployees } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import { downloadFile } from '@/lib/export-utils';

interface ParsedEntry {
  employee_number: string;
  date: string;
  clock_in: string;
  clock_out: string;
  employee_id?: string;
  valid: boolean;
  error?: string;
}

export function TimeEntryImportDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { companyId } = useTenant();
  const { data: employees } = useEmployees();
  const queryClient = useQueryClient();

  const parseCSV = (text: string): ParsedEntry[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const requiredHeaders = ['employee_number', 'date', 'clock_in', 'clock_out'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    const employeeMap = new Map(employees?.map(e => [e.employee_number, e.id]) || []);

    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const entry: ParsedEntry = {
        employee_number: values[headers.indexOf('employee_number')] || '',
        date: values[headers.indexOf('date')] || '',
        clock_in: values[headers.indexOf('clock_in')] || '',
        clock_out: values[headers.indexOf('clock_out')] || '',
        valid: true,
      };

      // Validate and lookup employee
      const employeeId = employeeMap.get(entry.employee_number);
      if (!employeeId) {
        entry.valid = false;
        entry.error = 'Employee not found';
      } else {
        entry.employee_id = employeeId;
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        entry.valid = false;
        entry.error = 'Invalid date format (use YYYY-MM-DD)';
      }

      // Validate time format
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(entry.clock_in)) {
        entry.valid = false;
        entry.error = 'Invalid clock_in time format (use HH:MM or HH:MM:SS)';
      }

      if (entry.clock_out && !/^\d{2}:\d{2}(:\d{2})?$/.test(entry.clock_out)) {
        entry.valid = false;
        entry.error = 'Invalid clock_out time format';
      }

      return entry;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        setParsedData(parsed);
      } catch (error) {
        setParseError((error as Error).message);
        setParsedData([]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validEntries = parsedData.filter(e => e.valid && e.employee_id);
      
      const entriesToInsert = validEntries.map(entry => ({
        company_id: companyId,
        employee_id: entry.employee_id!,
        date: entry.date,
        clock_in: `${entry.date}T${entry.clock_in}`,
        clock_out: entry.clock_out ? `${entry.date}T${entry.clock_out}` : null,
      }));

      const { error } = await supabase
        .from('time_entries')
        .insert(entriesToInsert);

      if (error) throw error;
      return validEntries.length;
    },
    onSuccess: (count) => {
      toast.success(`Successfully imported ${count} time entries`);
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to import time entries');
      console.error(error);
    },
  });

  const resetForm = () => {
    setFile(null);
    setParsedData([]);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const template = `employee_number,date,clock_in,clock_out
EMP-001,2024-01-15,09:00,17:30
EMP-002,2024-01-15,08:30,17:00`;
    downloadFile(template, 'time-entry-import-template.csv');
  };

  const validCount = parsedData.filter(e => e.valid).length;
  const invalidCount = parsedData.filter(e => !e.valid).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Time Entries</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Upload CSV File</Label>
              <Button variant="link" size="sm" onClick={handleDownloadTemplate} className="h-auto p-0">
                <Download className="h-3 w-3 mr-1" />
                Download Template
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex-1"
              />
              {file && (
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Parse Error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="text-destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {invalidCount} invalid
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Employee #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((entry, idx) => (
                      <TableRow key={idx} className={!entry.valid ? 'bg-destructive/10' : ''}>
                        <TableCell>
                          {entry.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>{entry.employee_number}</TableCell>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.clock_in}</TableCell>
                        <TableCell>{entry.clock_out || '-'}</TableCell>
                        <TableCell className="text-destructive text-sm">
                          {entry.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => importMutation.mutate()}
                  disabled={validCount === 0 || importMutation.isPending}
                >
                  {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import {validCount} Entries
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}