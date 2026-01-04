import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { FileText, Download, Receipt, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useLocalization } from '@/contexts/LocalizationContext';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'void';
  invoice_date: string;
  due_date: string | null;
  paid_at: string | null;
  pdf_url: string | null;
  stripe_invoice_id: string | null;
}

function getStatusBadgeVariant(status: Invoice['status']) {
  switch (status) {
    case 'paid':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'void':
      return 'outline';
    default:
      return 'outline';
  }
}

export function InvoiceHistory() {
  const { companyId } = useTenant();
  const { formatCurrency } = useLocalization();
  
  // This would typically fetch from a company_invoices table
  // For now, we'll show a placeholder since Stripe integration handles this
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['company-invoices', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // Check if invoices table exists - if not, return empty array
      // In production, this would fetch from Stripe or a local invoices table
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select('metadata')
        .eq('company_id', companyId)
        .single();
      
      if (error || !data?.metadata) return [];
      
      // Parse invoices from metadata if stored there
      const metadata = data.metadata as { invoices?: Invoice[] };
      return metadata.invoices || [];
    },
    enabled: !!companyId,
  });

  const handleDownload = (invoice: Invoice) => {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoice History
          </CardTitle>
          <CardDescription>View and download past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Invoice History
        </CardTitle>
        <CardDescription>View and download past invoices</CardDescription>
      </CardHeader>
      <CardContent>
        {invoices && invoices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{invoice.invoice_number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(invoice.amount / 100, invoice.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invoice.pdf_url && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDownload(invoice)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No invoices yet</p>
            <p className="text-sm text-muted-foreground">
              Invoices will appear here after your first billing cycle.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
