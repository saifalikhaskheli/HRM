import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, History, TrendingUp } from 'lucide-react';
import { useCurrentSalary, useSalaryHistory, useAddSalary } from '@/hooks/useSalaryHistory';
import { useLocalization, CURRENCY_CONFIG } from '@/contexts/LocalizationContext';
import { format } from 'date-fns';

interface SalarySectionProps {
  employeeId: string;
  canEdit?: boolean;
  readOnly?: boolean;
}

const SALARY_REASONS = [
  { value: 'initial', label: 'Initial Salary' },
  { value: 'increment', label: 'Annual Increment' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'adjustment', label: 'Salary Adjustment' },
  { value: 'other', label: 'Other' },
];

// Generate currency options from CURRENCY_CONFIG
const CURRENCIES = Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
  value: code,
  label: `${code} (${config.symbol})`,
}));

export function SalarySection({ employeeId, canEdit = false, readOnly = false }: SalarySectionProps) {
  const { data: currentSalary, isLoading: loadingCurrent } = useCurrentSalary(employeeId);
  const { data: salaryHistory, isLoading: loadingHistory } = useSalaryHistory(employeeId);
  const addSalary = useAddSalary();
  const { formatCurrency, settings } = useLocalization();
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newSalary, setNewSalary] = useState({
    base_salary: '',
    salary_currency: settings.currency,
    effective_from: new Date().toISOString().split('T')[0],
    reason: 'initial',
  });

  const handleAddSalary = async () => {
    if (!newSalary.base_salary) return;
    
    await addSalary.mutateAsync({
      employee_id: employeeId,
      base_salary: parseFloat(newSalary.base_salary),
      salary_currency: newSalary.salary_currency,
      effective_from: newSalary.effective_from,
      reason: SALARY_REASONS.find(r => r.value === newSalary.reason)?.label || newSalary.reason,
    });
    
    setAddDialogOpen(false);
    setNewSalary({
      base_salary: '',
      salary_currency: settings.currency,
      effective_from: new Date().toISOString().split('T')[0],
      reason: 'initial',
    });
  };

  if (loadingCurrent) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Salary Information
            </CardTitle>
            <CardDescription>
              {readOnly ? 'Your compensation details' : 'Employee compensation details'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {salaryHistory && salaryHistory.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-4 w-4 mr-1" />
                {showHistory ? 'Hide' : 'History'}
              </Button>
            )}
            {canEdit && !readOnly && (
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    {currentSalary ? 'Update Salary' : 'Add Salary'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {currentSalary ? 'Update Salary' : 'Set Initial Salary'}
                    </DialogTitle>
                    <DialogDescription>
                      {currentSalary 
                        ? 'Add a new salary record. The previous salary will be closed automatically.'
                        : 'Set the initial salary for this employee.'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Base Salary *</Label>
                        <Input
                          type="number"
                          value={newSalary.base_salary}
                          onChange={(e) => setNewSalary({ ...newSalary, base_salary: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select 
                          value={newSalary.salary_currency}
                          onValueChange={(v) => setNewSalary({ ...newSalary, salary_currency: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Effective From *</Label>
                      <Input
                        type="date"
                        value={newSalary.effective_from}
                        onChange={(e) => setNewSalary({ ...newSalary, effective_from: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Select 
                        value={newSalary.reason}
                        onValueChange={(v) => setNewSalary({ ...newSalary, reason: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SALARY_REASONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddSalary} 
                      disabled={addSalary.isPending || !newSalary.base_salary}
                    >
                      {addSalary.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {currentSalary ? (
          <div className="space-y-4">
            {/* Current Salary Display */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Current Salary</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(Number(currentSalary.base_salary), currentSalary.salary_currency || settings.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Effective from {format(new Date(currentSalary.effective_from), 'MMM d, yyyy')}
                </p>
              </div>
              {currentSalary.reason && (
                <Badge variant="secondary">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {currentSalary.reason}
                </Badge>
              )}
            </div>

            {/* Salary History */}
            {showHistory && salaryHistory && salaryHistory.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Salary History</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Effective To</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {formatCurrency(Number(record.base_salary), record.salary_currency || settings.currency)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.effective_from), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {record.effective_to 
                            ? format(new Date(record.effective_to), 'MMM d, yyyy')
                            : <Badge variant="outline" className="text-xs">Current</Badge>
                          }
                        </TableCell>
                        <TableCell>{record.reason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No salary record on file.</p>
            {canEdit && !readOnly && (
              <p className="text-sm">Click "Add Salary" to set the initial salary.</p>
            )}
            {readOnly && (
              <p className="text-sm">Please contact HR for salary information.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
