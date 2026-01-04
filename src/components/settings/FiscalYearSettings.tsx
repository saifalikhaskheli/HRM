import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useCurrentCompany } from '@/hooks/useCompany';
import { Calendar, Loader2, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function getFiscalYearDescription(startMonth: number): string {
  const startMonthName = MONTHS.find(m => parseInt(m.value) === startMonth)?.label || 'January';
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endMonthName = MONTHS.find(m => parseInt(m.value) === endMonth)?.label || 'December';
  
  if (startMonth === 1) {
    return `Your fiscal year runs from January 1 to December 31 (calendar year)`;
  }
  
  return `Your fiscal year runs from ${startMonthName} 1 to ${endMonthName} (end of month)`;
}

function getCurrentFiscalYear(startMonth: number): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  
  if (startMonth === 1) {
    return currentYear.toString();
  }
  
  // If we're before the start month, we're in the previous fiscal year
  if (currentMonth < startMonth) {
    return `FY${currentYear - 1}-${currentYear.toString().slice(-2)}`;
  }
  
  return `FY${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
}

export function FiscalYearSettings() {
  const { companyId, isFrozen, isAdmin } = useTenant();
  const { data: company } = useCurrentCompany();
  const queryClient = useQueryClient();
  
  const [fiscalYearStart, setFiscalYearStart] = useState('1');
  const [hasChanges, setHasChanges] = useState(false);

  // Load current setting
  useEffect(() => {
    if (company?.fiscal_year_start) {
      setFiscalYearStart(company.fiscal_year_start.toString());
    }
  }, [company?.fiscal_year_start]);

  const updateFiscalYear = useMutation({
    mutationFn: async (startMonth: number) => {
      if (!companyId) throw new Error('No company selected');

      const { error } = await supabase
        .from('companies')
        .update({
          fiscal_year_start: startMonth,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success('Fiscal year settings updated');
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleChange = (value: string) => {
    setFiscalYearStart(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    updateFiscalYear.mutate(parseInt(fiscalYearStart, 10));
  };

  const startMonth = parseInt(fiscalYearStart, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Fiscal Year
        </CardTitle>
        <CardDescription>
          Configure your organization's fiscal year for reports and payroll
          {isFrozen && <span className="ml-2 text-destructive">(Read-only while frozen)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="fiscal-year-start">Fiscal Year Starts In</Label>
            <Select
              value={fiscalYearStart}
              onValueChange={handleChange}
              disabled={isFrozen || !isAdmin}
            >
              <SelectTrigger id="fiscal-year-start" className="w-full sm:w-[250px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {isAdmin && hasChanges && (
            <Button
              onClick={handleSave}
              disabled={updateFiscalYear.isPending || isFrozen}
            >
              {updateFiscalYear.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          )}
        </div>

        <div className="p-4 rounded-lg bg-muted/50 space-y-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {getFiscalYearDescription(startMonth)}
            </p>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Current Fiscal Year:</span>
            <span className="font-medium">{getCurrentFiscalYear(startMonth)}</span>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            The fiscal year setting affects how data is grouped in reports, payroll summaries, 
            and financial analytics. Changes will apply to future reports.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
