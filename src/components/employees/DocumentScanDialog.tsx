import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scan, Upload, Check, AlertTriangle, FileImage, Loader2, Copy } from 'lucide-react';
import { useOCR, type ExtractedData } from '@/hooks/useOCR';
import { toast } from 'sonner';

interface DocumentScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataExtracted: (data: Partial<ExtractedData>) => void;
}

export function DocumentScanDialog({ open, onOpenChange, onDataExtracted }: DocumentScanDialogProps) {
  const { extractText, isProcessing, progress, error } = useOCR();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setSelectedFile(file);
    setExtractedData(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleScan = async () => {
    if (!selectedFile) return;
    
    try {
      const data = await extractText(selectedFile);
      setExtractedData(data);
      toast.success('Document scanned successfully');
    } catch (err) {
      toast.error('Failed to scan document');
    }
  };

  const handleApplyData = () => {
    if (!extractedData) return;
    
    onDataExtracted({
      firstName: extractedData.firstName,
      lastName: extractedData.lastName,
      nationalId: extractedData.nationalId,
      dateOfBirth: extractedData.dateOfBirth,
      gender: extractedData.gender,
      email: extractedData.email,
      phone: extractedData.phone,
    });
    
    toast.success('Data applied to form');
    handleClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    onOpenChange(false);
  };

  const copyFullText = () => {
    if (extractedData?.fullText) {
      navigator.clipboard.writeText(extractedData.fullText);
      toast.success('Text copied to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Scan ID Document
          </DialogTitle>
          <DialogDescription>
            Upload an ID card (CNIC, passport, etc.) to automatically extract employee information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Zone */}
          {!previewUrl && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FileImage className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Drop ID document image here</p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports CNIC, passport, driver's license, and other ID cards
              </p>
              <Label htmlFor="scan-file-input">
                <Button variant="secondary" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files
                  </span>
                </Button>
              </Label>
              <Input
                id="scan-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Preview & Actions */}
          {previewUrl && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Image Preview */}
              <div className="space-y-4">
                <div className="relative border rounded-lg overflow-hidden bg-muted">
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="w-full h-auto max-h-[300px] object-contain"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setExtractedData(null);
                    }}
                  >
                    Change Image
                  </Button>
                  <Button
                    onClick={handleScan}
                    disabled={isProcessing}
                    size="sm"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Scan className="h-4 w-4 mr-2" />
                        Scan Document
                      </>
                    )}
                  </Button>
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      Processing... {progress}%
                    </p>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Extracted Data */}
              <div className="space-y-4">
                {extractedData ? (
                  <>
                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Extracted Information</h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            extractedData.confidence > 70 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : extractedData.confidence > 50
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {Math.round(extractedData.confidence)}% confidence
                          </span>
                        </div>

                        {extractedData.firstName && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">First Name:</span>
                            <span className="font-medium">{extractedData.firstName}</span>
                          </div>
                        )}
                        {extractedData.lastName && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Last Name:</span>
                            <span className="font-medium">{extractedData.lastName}</span>
                          </div>
                        )}
                        {extractedData.nationalId && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">National ID:</span>
                            <span className="font-medium font-mono">{extractedData.nationalId}</span>
                          </div>
                        )}
                        {extractedData.dateOfBirth && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Date of Birth:</span>
                            <span className="font-medium">{extractedData.dateOfBirth}</span>
                          </div>
                        )}
                        {extractedData.gender && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Gender:</span>
                            <span className="font-medium capitalize">{extractedData.gender}</span>
                          </div>
                        )}
                        {extractedData.phone && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Phone:</span>
                            <span className="font-medium">{extractedData.phone}</span>
                          </div>
                        )}
                        {extractedData.email && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Email:</span>
                            <span className="font-medium">{extractedData.email}</span>
                          </div>
                        )}

                        {!extractedData.firstName && !extractedData.nationalId && (
                          <p className="text-sm text-muted-foreground italic">
                            Could not automatically extract structured data. See raw text below.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">Raw Extracted Text</h4>
                          <Button variant="ghost" size="sm" onClick={copyFullText}>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <div className="bg-muted rounded p-3 max-h-[150px] overflow-y-auto">
                          <pre className="text-xs whitespace-pre-wrap font-mono">
                            {extractedData.fullText || 'No text extracted'}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>

                    <Button onClick={handleApplyData} className="w-full">
                      <Check className="h-4 w-4 mr-2" />
                      Apply Extracted Data
                    </Button>
                  </>
                ) : (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <Scan className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Click "Scan Document" to extract information</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              For best results, ensure the document image is clear, well-lit, and the text is readable.
              Supported formats: CNIC, passport, driver's license, and other ID cards.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}
