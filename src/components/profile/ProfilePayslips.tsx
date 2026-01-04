import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PayslipDownloadButton } from '@/components/payroll/PayslipDownloadButton';
import { FileText, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { useLocalization } from '@/contexts/LocalizationContext';

interface PayslipEntry {
  id: string;
  base_salary: number;
  gross_pay: number;
  net_pay: number;
  total_deductions: number;
  created_at: string;
  payroll_run: {
    id: string;
    name: string;
    period_start: string;
    period_end: string;
    pay_date: string;
    status: string;
  } | null;
}

interface ProfilePayslipsProps {
  employeeId: string;
}

export function ProfilePayslips({ employeeId }: ProfilePayslipsProps) {
  const { companyId } = useTenant();
  const { formatCurrency } = useLocalization();

  const { data: payslips, isLoading } = useQuery({
    queryKey: ['employee-payslips', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('payroll_entries')
        .select(`
          id,
          base_salary,
          gross_pay,
          net_pay,
          total_deductions,
          created_at,
          payroll_run:payroll_runs(id, name, period_start, period_end, pay_date, status)
        `)
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Only show completed payroll runs
      return (data as PayslipEntry[]).filter(
        p => p.payroll_run?.status === 'completed'
      );
    },
    enabled: !!companyId && !!employeeId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Payslips
        </CardTitle>
        <CardDescription>
          View and download your payslips from completed payroll runs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !payslips?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No payslips available yet</p>
            <p className="text-sm">Payslips will appear here after payroll is processed.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Pay Date</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((payslip) => (
                <TableRow key={payslip.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{payslip.payroll_run?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {payslip.payroll_run?.period_start && payslip.payroll_run?.period_end && (
                          <>
                            {format(new Date(payslip.payroll_run.period_start), 'MMM d')} -{' '}
                            {format(new Date(payslip.payroll_run.period_end), 'MMM d, yyyy')}
                          </>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {payslip.payroll_run?.pay_date && 
                      format(new Date(payslip.payroll_run.pay_date), 'MMM d, yyyy')
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(payslip.gross_pay)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    -{formatCurrency(payslip.total_deductions)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(payslip.net_pay)}
                  </TableCell>
                  <TableCell>
                    <PayslipDownloadButton entryId={payslip.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
