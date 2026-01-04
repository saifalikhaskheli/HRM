import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FileText, Download, Loader2, ChevronDown, Check, User } from 'lucide-react';
import { useEmployees, type Employee } from '@/hooks/useEmployees';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { PayslipDownloadButton } from './PayslipDownloadButton';

interface PayslipGeneratorDialogProps {
  trigger?: React.ReactNode;
}

export function PayslipGeneratorDialog({ trigger }: PayslipGeneratorDialogProps) {
  const [open, setOpen] = useState(false);
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [generationType, setGenerationType] = useState<'current' | 'custom' | 'history'>('current');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const { companyId } = useTenant();
  const { data: employees } = useEmployees();

  // Fetch payroll entries for selected employee
  const { data: employeePayrollHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['employee-payroll-history', selectedEmployee?.id],
    queryFn: async () => {
      if (!selectedEmployee?.id) return [];
      
      const { data, error } = await supabase
        .from('payroll_entries')
        .select(`
          *,
          payroll_run:payroll_runs(name, period_start, period_end, pay_date, status)
        `)
        .eq('employee_id', selectedEmployee.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedEmployee?.id,
  });

  const currentMonthEntries = employeePayrollHistory?.filter(entry => {
    const runDate = new Date((entry.payroll_run as any)?.period_start);
    const now = new Date();
    return runDate.getMonth() === now.getMonth() && runDate.getFullYear() === now.getFullYear();
  });

  const customRangeEntries = employeePayrollHistory?.filter(entry => {
    if (!customStartDate || !customEndDate) return false;
    const runDate = new Date((entry.payroll_run as any)?.period_start);
    return runDate >= new Date(customStartDate) && runDate <= new Date(customEndDate);
  });

  const displayedEntries = 
    generationType === 'current' ? currentMonthEntries :
    generationType === 'custom' ? customRangeEntries :
    employeePayrollHistory;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Generate Payslips
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Employee Payslips</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Search */}
          <div className="space-y-2">
            <Label>Select Employee</Label>
            <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={employeeSearchOpen}
                  className="w-full justify-between"
                >
                  {selectedEmployee ? (
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {selectedEmployee.first_name} {selectedEmployee.last_name}
                      <span className="text-muted-foreground">({selectedEmployee.employee_number})</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Search for an employee...</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Search by name or employee number..." />
                  <CommandList>
                    <CommandEmpty>No employee found.</CommandEmpty>
                    <CommandGroup>
                      {employees?.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={`${emp.first_name} ${emp.last_name} ${emp.employee_number}`}
                          onSelect={() => {
                            setSelectedEmployee(emp);
                            setEmployeeSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedEmployee?.id === emp.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{emp.first_name} {emp.last_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {emp.employee_number} • {emp.email}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedEmployee && (
            <>
              {/* Employee Summary */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedEmployee.job_title || 'No title'}</p>
                    </div>
                    <Badge variant="outline">
                      {employeePayrollHistory?.length || 0} payroll records
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Generation Type */}
              <div className="space-y-3">
                <Label>Payslip Period</Label>
                <RadioGroup value={generationType} onValueChange={(v) => setGenerationType(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="current" id="current" />
                    <Label htmlFor="current" className="font-normal cursor-pointer">
                      Current Month ({format(new Date(), 'MMMM yyyy')})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="font-normal cursor-pointer">
                      Custom Date Range
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="history" id="history" />
                    <Label htmlFor="history" className="font-normal cursor-pointer">
                      Full Payroll History
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Custom Date Range */}
              {generationType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input 
                      type="date" 
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input 
                      type="date" 
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Payslip Results */}
              <div className="space-y-2">
                <Label>Available Payslips ({displayedEntries?.length || 0})</Label>
                <ScrollArea className="h-[200px] border rounded-md">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : displayedEntries && displayedEntries.length > 0 ? (
                    <div className="p-2 space-y-2">
                      {displayedEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                          <div>
                            <p className="font-medium text-sm">
                              {(entry.payroll_run as any)?.name || 'Payroll'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(entry.payroll_run as any)?.period_start} to {(entry.payroll_run as any)?.period_end}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              ${Number(entry.net_pay).toLocaleString()}
                            </span>
                            <PayslipDownloadButton 
                              entryId={entry.id}
                              employeeName={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No payslips found for this period</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}