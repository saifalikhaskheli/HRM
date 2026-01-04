import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, AlertCircle, CheckCircle2, FileJson, Download } from 'lucide-react';
import { parseLeavePolicyFile, downloadLeavePolicyTemplate, type LeavePolicyItem, type LeavePolicyExport } from '@/lib/leave-policy-utils';
import { useBulkImportLeaveTypes } from '@/hooks/useLeave';

interface LeavePolicyImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCodes: string[];
}

type ConflictMode = 'skip' | 'update';

interface PreviewItem extends LeavePolicyItem {
  status: 'new' | 'duplicate' | 'error';
  errorMessage?: string;
}

export function LeavePolicyImportDialog({ 
  open, 
  onOpenChange,
  existingCodes 
}: LeavePolicyImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<LeavePolicyExport | null>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [conflictMode, setConflictMode] = useState<ConflictMode>('skip');
  const [isDragging, setIsDragging] = useState(false);

  const bulkImport = useBulkImportLeaveTypes();

  const resetState = useCallback(() => {
    setFile(null);
    setParsedData(null);
    setPreviewItems([]);
    setParseError(null);
    setConflictMode('skip');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  const processFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);
    setParsedData(null);
    setPreviewItems([]);

    try {
      const data = await parseLeavePolicyFile(selectedFile);
      setParsedData(data);

      // Check for duplicates
      const existingCodesLower = existingCodes.map(c => c.toLowerCase());
      const preview: PreviewItem[] = data.leaveTypes.map((lt) => ({
        ...lt,
        status: existingCodesLower.includes(lt.code.toLowerCase()) ? 'duplicate' : 'new',
      }));
      setPreviewItems(preview);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  }, [existingCodes]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/json') {
      processFile(droppedFile);
    } else {
      setParseError('Please drop a valid JSON file');
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleImport = async () => {
    if (!parsedData) return;

    const itemsToImport = previewItems.filter(
      (item) => item.status === 'new' || (item.status === 'duplicate' && conflictMode === 'update')
    );

    if (itemsToImport.length === 0) {
      setParseError('No items to import. All items would be skipped.');
      return;
    }

    try {
      const result = await bulkImport.mutateAsync({
        items: itemsToImport,
        updateExisting: conflictMode === 'update',
      });

      handleClose();
    } catch (err) {
      // Error handled by mutation
    }
  };

  const newCount = previewItems.filter(i => i.status === 'new').length;
  const duplicateCount = previewItems.filter(i => i.status === 'duplicate').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Leave Policies</DialogTitle>
          <DialogDescription>
            Upload a JSON file containing leave type configurations to import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {!parsedData ? (
            <>
              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="leave-policy-file"
                />
                <label htmlFor="leave-policy-file" className="cursor-pointer">
                  <FileJson className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drop a JSON file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports leave policy export files (.json)
                  </p>
                </label>
              </div>

              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadLeavePolicyTemplate}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileJson className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {parsedData.leaveTypes.length} leave type(s)
                    {parsedData.sourceCompany && ` • From: ${parsedData.sourceCompany}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  Change
                </Button>
              </div>

              {/* Summary */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    {newCount} New
                  </Badge>
                </div>
                {duplicateCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-amber-500 text-white">
                      {duplicateCount} Duplicate(s)
                    </Badge>
                  </div>
                )}
              </div>

              {/* Conflict Resolution */}
              {duplicateCount > 0 && (
                <div className="p-3 border rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    How should duplicates be handled?
                  </p>
                  <RadioGroup 
                    value={conflictMode} 
                    onValueChange={(v) => setConflictMode(v as ConflictMode)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="skip" id="skip" />
                      <Label htmlFor="skip" className="cursor-pointer">Skip duplicates</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="update" id="update" />
                      <Label htmlFor="update" className="cursor-pointer">Update existing</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.color && (
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: item.color }}
                              />
                            )}
                            <span className="font-medium">{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {item.code}
                          </code>
                        </TableCell>
                        <TableCell>{item.default_days ?? '-'}</TableCell>
                        <TableCell>
                          {item.is_paid !== undefined ? (
                            item.is_paid ? 'Yes' : 'No'
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {item.status === 'new' ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              New
                            </Badge>
                          ) : item.status === 'duplicate' ? (
                            <Badge variant="secondary" className="bg-amber-500 text-white">
                              {conflictMode === 'skip' ? 'Skip' : 'Update'}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Error</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Error Display */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-wrap">
                {parseError}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!parsedData || bulkImport.isPending || previewItems.length === 0}
          >
            {bulkImport.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {conflictMode === 'skip' ? newCount : previewItems.length} Leave Type(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
