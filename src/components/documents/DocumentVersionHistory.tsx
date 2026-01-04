import { useState } from 'react';
import { format } from 'date-fns';
import { History, Download, Eye, FileText, Clock, ArrowUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDocumentVersions, useDocumentAccess } from '@/hooks/useDocuments';

interface DocumentVersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentTitle: string;
}

export function DocumentVersionHistory({
  open,
  onOpenChange,
  documentId,
  documentTitle,
}: DocumentVersionHistoryProps) {
  const { data: versions, isLoading } = useDocumentVersions(documentId);
  const documentAccess = useDocumentAccess();

  const base64ToBlob = (base64: string, mimeType: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  };

  const handleView = async (docId: string) => {
    try {
      const result = await documentAccess.mutateAsync({
        documentId: docId,
        accessType: 'view',
        responseMode: 'base64',
      });

      if (!('fileBase64' in result)) throw new Error('Preview not available');

      const blob = base64ToBlob(result.fileBase64, result.mimeType);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const result = await documentAccess.mutateAsync({
        documentId: docId,
        accessType: 'download',
        responseMode: 'base64',
      });

      if (!('fileBase64' in result)) throw new Error('Download not available');

      const blob = base64ToBlob(result.fileBase64, result.mimeType);
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    } catch (error) {
      // Error handled by hook
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{documentTitle}</p>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : versions && versions.length > 0 ? (
            <div className="space-y-3">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`relative p-4 rounded-lg border ${
                    version.is_latest_version
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  {/* Version indicator line */}
                  {index < versions.length - 1 && (
                    <div className="absolute left-7 top-14 h-[calc(100%+12px)] w-0.5 bg-border" />
                  )}

                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        version.is_latest_version
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {version.is_latest_version ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          Version {version.version_number || 1}
                        </span>
                        {version.is_latest_version && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        {version.file_name} • {formatFileSize(version.file_size)}
                      </p>

                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(version.id)}
                          disabled={documentAccess.isPending}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(version.id, version.file_name)}
                          disabled={documentAccess.isPending}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No version history available</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
