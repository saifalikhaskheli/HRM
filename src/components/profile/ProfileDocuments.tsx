import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Eye, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface ProfileDocumentsProps {
  employeeId: string;
}

interface Document {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  verification_status: string | null;
  expiry_date: string | null;
  created_at: string;
  document_type: { name: string } | null;
}

export function ProfileDocuments({ employeeId }: ProfileDocumentsProps) {
  const { companyId } = useTenant();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['employee-documents', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('employee_documents')
        .select(`
          id,
          title,
          file_name,
          file_url,
          verification_status,
          expiry_date,
          created_at,
          document_type:document_types(name)
        `)
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Document[];
    },
    enabled: !!companyId && !!employeeId,
  });

  const getStatusBadge = (status: string | null, expiryDate: string | null) => {
    if (expiryDate && new Date(expiryDate) < new Date()) {
      return <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
    }
    
    switch (status) {
      case 'verified':
        return <Badge variant="default" className="text-xs bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Uploaded</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents
            </CardTitle>
            <CardDescription>
              Your uploaded documents and their verification status
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/documents">View All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !documents?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No documents uploaded</p>
            <p className="text-sm">Your uploaded documents will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{doc.document_type?.name || 'Document'}</span>
                      <span>•</span>
                      <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(doc.verification_status, doc.expiry_date)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
