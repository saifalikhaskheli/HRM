import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Trash2,
  ShieldCheck,
  XCircle,
  RefreshCw,
  History,
  FileSearch
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useVerifyDocument, useDeleteDocument, useDocumentAccess } from '@/hooks/useDocuments';
import { usePermission } from '@/contexts/PermissionContext';
import { toast } from 'sonner';
import { DocumentVersionHistory } from './DocumentVersionHistory';
import { DocumentOCRViewer } from './DocumentOCRViewer';
import { TablePagination } from '@/components/ui/table-pagination';
import type { Json } from '@/integrations/supabase/types';

interface DocumentWithRelations {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  is_verified: boolean | null;
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired' | null;
  rejection_reason: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  created_at: string;
  description: string | null;
  version_number: number | null;
  is_latest_version: boolean | null;
  parent_document_id: string | null;
  ocr_text: string | null;
  ocr_extracted_data: Json | null;
  ocr_processed: boolean | null;
  ocr_processed_at: string | null;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  document_type?: {
    id: string;
    name: string;
    code: string;
  } | null;
  verified_by_employee?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface Props {
  documents: DocumentWithRelations[];
  isLoading?: boolean;
  showEmployee?: boolean;
  onUploadVersion?: (documentId: string) => void;
}

export function DocumentList({ documents, isLoading, showEmployee = true, onUploadVersion }: Props) {
  const { can } = usePermission();
  const verifyDocument = useVerifyDocument();
  const deleteDocument = useDeleteDocument();
  const documentAccess = useDocumentAccess();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  
  // Version history dialog state
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryDoc, setVersionHistoryDoc] = useState<{ id: string; title: string } | null>(null);
  
  // OCR viewer dialog state
  const [ocrViewerOpen, setOcrViewerOpen] = useState(false);
  const [ocrDoc, setOcrDoc] = useState<DocumentWithRelations | null>(null);

  const canVerify = can('documents', 'verify');
  const canDelete = can('documents', 'delete');

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return documents.slice(start, start + PAGE_SIZE);
  }, [documents, currentPage]);

  const base64ToBlob = (base64: string, mimeType: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  };

  const handleDownload = async (doc: DocumentWithRelations) => {
    try {
      const result = await documentAccess.mutateAsync({
        documentId: doc.id,
        accessType: 'download',
        responseMode: 'base64',
      });

      if (!('fileBase64' in result)) throw new Error('Download not available');

      const blob = base64ToBlob(result.fileBase64, result.mimeType);
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    } catch (error: any) {
      // Error already handled by hook
    }
  };

  const handleView = async (doc: DocumentWithRelations) => {
    try {
      const result = await documentAccess.mutateAsync({
        documentId: doc.id,
        accessType: 'view',
        responseMode: 'base64',
      });

      if (!('fileBase64' in result)) throw new Error('Preview not available');

      const blob = base64ToBlob(result.fileBase64, result.mimeType);
      const url = URL.createObjectURL(blob);

      const popup = window.open(url, '_blank');
      if (!popup) {
        toast.message('Popup blocked', {
          description: 'Please allow popups for this site to view documents in a new tab.',
        });
      }

      // Cleanup later to avoid breaking the opened tab
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      // Error already handled by hook
    }
  };

  const handleVerify = (id: string) => {
    verifyDocument.mutate({ id, status: 'verified' });
  };

  const handleReject = () => {
    if (selectedDocId && rejectionReason.trim()) {
      verifyDocument.mutate({ 
        id: selectedDocId, 
        status: 'rejected', 
        rejectionReason: rejectionReason.trim() 
      });
      setRejectDialogOpen(false);
      setSelectedDocId(null);
      setRejectionReason('');
    }
  };

  const handleDelete = () => {
    if (selectedDocId) {
      deleteDocument.mutate(selectedDocId);
      setDeleteDialogOpen(false);
      setSelectedDocId(null);
    }
  };

  const getVerificationStatusBadge = (doc: DocumentWithRelations) => {
    const status = doc.verification_status || (doc.is_verified ? 'verified' : 'pending');
    
    switch (status) {
      case 'verified':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { label: 'Expired', variant: 'destructive' as const, icon: AlertTriangle };
    } else if (daysUntilExpiry <= 30) {
      return { label: 'Expiring Soon', variant: 'secondary' as const, icon: Clock };
    }
    return null;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No documents found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              {showEmployee && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDocuments.map((doc) => {
              const expiryStatus = getExpiryStatus(doc.expiry_date);
              const status = doc.verification_status || (doc.is_verified ? 'verified' : 'pending');
              
              return (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted rounded">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{doc.title}</p>
                          {doc.version_number && doc.version_number > 1 && (
                            <Badge variant="outline" className="text-xs">
                              v{doc.version_number}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {doc.file_name} • {formatFileSize(doc.file_size)}
                        </p>
                        {doc.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">
                            Reason: {doc.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  {showEmployee && (
                    <TableCell>
                      {doc.employee ? (
                        <span className="text-sm">
                          {doc.employee.first_name} {doc.employee.last_name}
                        </span>
                      ) : '-'}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline">
                      {doc.document_type?.name || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getVerificationStatusBadge(doc)}
                      {expiryStatus && (
                        <Badge variant={expiryStatus.variant}>
                          <expiryStatus.icon className="h-3 w-3 mr-1" />
                          {expiryStatus.label}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(doc.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(doc)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        
                        {/* Version history */}
                        {(doc.parent_document_id || (doc.version_number && doc.version_number > 1)) && (
                          <DropdownMenuItem onClick={() => {
                            setVersionHistoryDoc({ id: doc.parent_document_id || doc.id, title: doc.title });
                            setVersionHistoryOpen(true);
                          }}>
                            <History className="h-4 w-4 mr-2" />
                            Version History
                          </DropdownMenuItem>
                        )}
                        
                        {/* OCR Results */}
                        {doc.ocr_processed && (
                          <DropdownMenuItem onClick={() => {
                            setOcrDoc(doc);
                            setOcrViewerOpen(true);
                          }}>
                            <FileSearch className="h-4 w-4 mr-2" />
                            View OCR Results
                          </DropdownMenuItem>
                        )}
                        
                        {/* Upload new version */}
                        {onUploadVersion && doc.is_latest_version && (
                          <DropdownMenuItem onClick={() => onUploadVersion(doc.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Upload New Version
                          </DropdownMenuItem>
                        )}
                        
                        {/* Verification actions */}
                        {canVerify && status === 'pending' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleVerify(doc.id)}>
                              <ShieldCheck className="h-4 w-4 mr-2" />
                              Verify
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedDocId(doc.id);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        {/* Delete action */}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setSelectedDocId(doc.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        currentPage={currentPage}
        totalItems={documents.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this document. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Rejection Reason</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Please provide a reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
            >
              Reject Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <DocumentVersionHistory
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        documentId={versionHistoryDoc?.id || null}
        documentTitle={versionHistoryDoc?.title || ''}
      />

      {/* OCR Viewer Dialog */}
      <DocumentOCRViewer
        open={ocrViewerOpen}
        onOpenChange={setOcrViewerOpen}
        document={ocrDoc}
      />
    </>
  );
}
