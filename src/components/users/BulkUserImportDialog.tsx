import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';
import { useUserManagement } from '@/hooks/useUserManagement';
import type { AppRole } from '@/types/auth';

interface BulkUserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedUser {
  row: number;
  name: string;
  email: string;
  role: string;
  error?: string;
}

interface ImportResult {
  row: number;
  name: string;
  email: string;
  success: boolean;
  message: string;
}

const VALID_ROLES = ['company_admin', 'hr_manager', 'manager', 'employee'];

function parseCSV(content: string): ParsedUser[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const users: ParsedUser[] = [];
  const seenEmails = new Set<string>();

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV - handle quoted values
    const matches = line.match(/(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^,]+))/g) || [];
    const values = matches.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    
    const [name, email, role] = values;
    
    let error: string | undefined;

    if (!name || name.length === 0) {
      error = 'Name is required';
    } else if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      error = 'Invalid email format';
    } else if (!role || !VALID_ROLES.includes(role.toLowerCase())) {
      error = `Invalid role. Must be: ${VALID_ROLES.join(', ')}`;
    } else if (seenEmails.has(email.toLowerCase())) {
      error = 'Duplicate email in file';
    }

    if (!error && email) {
      seenEmails.add(email.toLowerCase());
    }

    users.push({
      row: i + 1,
      name: name || '',
      email: email || '',
      role: role?.toLowerCase() || '',
      error,
    });
  }

  return users;
}

export function BulkUserImportDialog({ open, onOpenChange }: BulkUserImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'results'>('upload');
  
  const { inviteUser } = useUserManagement();

  const validUsers = parsedUsers.filter(u => !u.error);
  const invalidUsers = parsedUsers.filter(u => u.error);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const users = parseCSV(content);
      setParsedUsers(users);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (validUsers.length === 0) return;
    
    setIsProcessing(true);
    const importResults: ImportResult[] = [];

    for (const user of validUsers) {
      const nameParts = user.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      try {
        await inviteUser.mutateAsync({
          email: user.email,
          role: user.role as AppRole,
          firstName,
          lastName,
        });
        importResults.push({
          row: user.row,
          name: user.name,
          email: user.email,
          success: true,
          message: 'User created successfully',
        });
      } catch (error) {
        importResults.push({
          row: user.row,
          name: user.name,
          email: user.email,
          success: false,
          message: error instanceof Error ? error.message : 'Failed to create user',
        });
      }
    }

    setResults(importResults);
    setStep('results');
    setIsProcessing(false);
  };

  const handleClose = () => {
    setParsedUsers([]);
    setResults([]);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const handleDownloadTemplate = () => {
    const template = 'name,email,role\nJohn Doe,john@example.com,employee\nJane Smith,jane@example.com,manager';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk User Import
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to create multiple user accounts at once.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload a CSV file with columns: name, email, role
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                Select CSV File
              </Button>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
              <div>
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground">
                  Download our CSV template with the correct format
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Valid roles:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>company_admin</code> - Full access</li>
                <li><code>hr_manager</code> - HR management access</li>
                <li><code>manager</code> - Team management access</li>
                <li><code>employee</code> - Basic access</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {invalidUsers.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  {invalidUsers.length} row(s) have errors and will be skipped.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4 text-sm">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {validUsers.length} valid
              </Badge>
              {invalidUsers.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {invalidUsers.length} invalid
                </Badge>
              )}
            </div>

            <ScrollArea className="h-64 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedUsers.map((user, idx) => (
                    <TableRow key={idx} className={user.error ? 'bg-destructive/10' : ''}>
                      <TableCell className="font-mono text-xs">{user.row}</TableCell>
                      <TableCell>{user.name || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{user.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.error ? (
                          <span className="text-xs text-destructive">{user.error}</span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex gap-4">
              {successCount > 0 && (
                <Alert className="flex-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    {successCount} user(s) created successfully
                  </AlertDescription>
                </Alert>
              )}
              {failCount > 0 && (
                <Alert variant="destructive" className="flex-1">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Failed</AlertTitle>
                  <AlertDescription>
                    {failCount} user(s) failed to create
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <ScrollArea className="h-64 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, idx) => (
                    <TableRow key={idx} className={!result.success ? 'bg-destructive/10' : ''}>
                      <TableCell className="font-mono text-xs">{result.row}</TableCell>
                      <TableCell>{result.name}</TableCell>
                      <TableCell className="font-mono text-xs">{result.email}</TableCell>
                      <TableCell>
                        {result.success ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Created
                          </Badge>
                        ) : (
                          <span className="text-xs text-destructive">{result.message}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validUsers.length === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import {validUsers.length} User(s)</>
                )}
              </Button>
            </>
          )}
          {step === 'results' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
