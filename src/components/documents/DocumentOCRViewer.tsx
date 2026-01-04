import { useState } from 'react';
import { FileSearch, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface DocumentOCRViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    title: string;
    ocr_text: string | null;
    ocr_extracted_data: Json | null;
    ocr_processed: boolean | null;
    ocr_processed_at: string | null;
  } | null;
}

export function DocumentOCRViewer({
  open,
  onOpenChange,
  document,
}: DocumentOCRViewerProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('text');

  const handleCopyText = async () => {
    if (document?.ocr_text) {
      await navigator.clipboard.writeText(document.ocr_text);
      setCopied(true);
      toast.success('Text copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatExtractedData = (data: Json | null) => {
    if (!data || typeof data !== 'object') return null;
    return JSON.stringify(data, null, 2);
  };

  const hasOCRContent = document?.ocr_text || document?.ocr_extracted_data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            OCR Results
          </DialogTitle>
          {document && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">{document.title}</span>
              {document.ocr_processed ? (
                <Badge variant="default" className="bg-green-500/10 text-green-600">
                  Processed
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Pending
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        {!document?.ocr_processed ? (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">OCR processing in progress...</p>
            <p className="text-xs text-muted-foreground mt-2">
              This may take a few moments depending on the document size.
            </p>
          </div>
        ) : !hasOCRContent ? (
          <div className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No text extracted from this document</p>
            <p className="text-xs text-muted-foreground mt-2">
              The document may be an image without readable text, or OCR was unable to detect any content.
            </p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" disabled={!document?.ocr_text}>
                Extracted Text
              </TabsTrigger>
              <TabsTrigger value="data" disabled={!document?.ocr_extracted_data}>
                Structured Data
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Extracted Text</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyText}
                    disabled={!document?.ocr_text}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <ScrollArea className="h-[300px] rounded-md border p-4 bg-muted/30">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {document?.ocr_text || 'No text extracted'}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-4">
              <div className="space-y-2">
                <Label>Structured Data (JSON)</Label>
                <ScrollArea className="h-[300px] rounded-md border p-4 bg-muted/30">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {formatExtractedData(document?.ocr_extracted_data) || 'No structured data available'}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
