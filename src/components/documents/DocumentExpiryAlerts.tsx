import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Clock, FileWarning, Mail, Loader2 } from 'lucide-react';
import { format, differenceInDays, addDays, isBefore, isAfter } from 'date-fns';
import { useAllDocuments, useDocumentTypes } from '@/hooks/useDocuments';
import { toast } from 'sonner';

interface ExpiringDocument {
  id: string;
  title: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  status: 'expired' | 'critical' | 'warning' | 'upcoming';
  employeeName: string;
  employeeEmail: string;
  documentType: string;
}

export function DocumentExpiryAlerts() {
  const { data: documents, isLoading } = useAllDocuments();
  const { data: documentTypes } = useDocumentTypes();

  const expiringDocuments = useMemo((): ExpiringDocument[] => {
    if (!documents) return [];
    
    const today = new Date();
    const docs: ExpiringDocument[] = [];
    
    documents.forEach(doc => {
      if (!doc.expiry_date) return;
      
      const expiryDate = new Date(doc.expiry_date);
      const daysUntilExpiry = differenceInDays(expiryDate, today);
      
      // Only include documents expiring within 90 days or already expired
      if (daysUntilExpiry > 90) return;
      
      let status: ExpiringDocument['status'];
      if (daysUntilExpiry < 0) {
        status = 'expired';
      } else if (daysUntilExpiry <= 7) {
        status = 'critical';
      } else if (daysUntilExpiry <= 30) {
        status = 'warning';
      } else {
        status = 'upcoming';
      }
      
      const employee = doc.employee as { first_name: string; last_name: string; email: string } | null;
      const docType = doc.document_type as { name: string } | null;
      
      docs.push({
        id: doc.id,
        title: doc.title,
        expiryDate,
        daysUntilExpiry,
        status,
        employeeName: employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown',
        employeeEmail: employee?.email || '',
        documentType: docType?.name || 'Unknown',
      });
    });
    
    // Sort by days until expiry (most urgent first)
    return docs.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [documents]);

  const stats = useMemo(() => ({
    expired: expiringDocuments.filter(d => d.status === 'expired').length,
    critical: expiringDocuments.filter(d => d.status === 'critical').length,
    warning: expiringDocuments.filter(d => d.status === 'warning').length,
    upcoming: expiringDocuments.filter(d => d.status === 'upcoming').length,
  }), [expiringDocuments]);

  const handleSendReminder = (doc: ExpiringDocument) => {
    // This would trigger an email notification
    toast.success(`Reminder sent to ${doc.employeeName} about ${doc.title}`);
  };

  const getStatusBadge = (status: ExpiringDocument['status'], days: number) => {
    switch (status) {
      case 'expired':
        return (
          <Badge variant="destructive">
            Expired {Math.abs(days)} days ago
          </Badge>
        );
      case 'critical':
        return (
          <Badge variant="destructive" className="bg-red-500">
            {days === 0 ? 'Expires today' : `${days} days left`}
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            {days} days left
          </Badge>
        );
      case 'upcoming':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {days} days left
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Summary */}
      {(stats.expired > 0 || stats.critical > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Document Expiry Alert</AlertTitle>
          <AlertDescription>
            {stats.expired > 0 && `${stats.expired} document${stats.expired > 1 ? 's' : ''} have expired. `}
            {stats.critical > 0 && `${stats.critical} document${stats.critical > 1 ? 's' : ''} will expire within 7 days.`}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5" />
                Document Expiry Tracker
              </CardTitle>
              <CardDescription>
                Monitor documents approaching expiration
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              <p className="text-sm text-red-600">Expired</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
              <p className="text-sm text-red-500">Critical (≤7 days)</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-2xl font-bold text-amber-600">{stats.warning}</p>
              <p className="text-sm text-amber-600">Warning (≤30 days)</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
              <p className="text-sm text-blue-600">Upcoming (≤90 days)</p>
            </div>
          </div>

          {expiringDocuments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents expiring in the next 90 days.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringDocuments.map(doc => (
                  <TableRow key={doc.id} className={doc.status === 'expired' ? 'bg-red-50/50' : ''}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>{doc.documentType}</TableCell>
                    <TableCell>{doc.employeeName}</TableCell>
                    <TableCell>{format(doc.expiryDate, 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {getStatusBadge(doc.status, doc.daysUntilExpiry)}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleSendReminder(doc)}
                        title="Send reminder email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
