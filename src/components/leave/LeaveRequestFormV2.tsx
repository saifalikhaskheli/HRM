import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, Info, Plus, Trash2 } from 'lucide-react';
import { useLeaveTypes, useCreateLeaveRequest } from '@/hooks/useLeave';
import { useMyLeaveBalances, useCheckLeaveBalance } from '@/hooks/useLeaveBalances';
import { TeamConflictWarning } from './TeamConflictWarning';
import { format, parseISO, isWeekend, addDays, isBefore, isAfter, isSameDay } from 'date-fns';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface LeaveDay {
  id: string;
  date: string;
  dayType: 'full' | 'first_half' | 'second_half';
}

const leaveSchema = z.object({
  leave_type_id: z.string().min(1, 'Leave type is required'),
  reason: z.string().optional(),
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

interface LeaveRequestFormV2Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function LeaveRequestFormV2({ onSuccess, onCancel }: LeaveRequestFormV2Props) {
  const { companyId, employeeId } = useTenant();
  const queryClient = useQueryClient();
  const { data: leaveTypes } = useLeaveTypes();
  const { data: balances, isLoading: balancesLoading } = useMyLeaveBalances();
  const checkBalance = useCheckLeaveBalance();
  
  const [leaveDays, setLeaveDays] = useState<LeaveDay[]>([]);
  const [newDate, setNewDate] = useState('');

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leave_type_id: '',
      reason: '',
    },
  });

  const selectedLeaveTypeId = form.watch('leave_type_id');
  const selectedBalance = balances?.find(b => b.leaveTypeId === selectedLeaveTypeId);

  // Calculate total days based on day types
  const totalDays = leaveDays.reduce((sum, day) => {
    return sum + (day.dayType === 'full' ? 1 : 0.5);
  }, 0);

  const isOverdraw = selectedBalance && totalDays > selectedBalance.remaining;

  // Get date range for conflict warning
  const sortedDates = [...leaveDays].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sortedDates[0]?.date;
  const endDate = sortedDates[sortedDates.length - 1]?.date;

  const addLeaveDay = () => {
    if (!newDate) return;
    
    // Check if date already exists
    if (leaveDays.some(d => d.date === newDate)) {
      toast.error('This date is already added');
      return;
    }

    // Check if it's a weekend
    if (isWeekend(parseISO(newDate))) {
      toast.error('Cannot add weekend dates');
      return;
    }

    const newDay: LeaveDay = {
      id: crypto.randomUUID(),
      date: newDate,
      dayType: 'full' as const,
    };

    setLeaveDays(prev => [...prev, newDay].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate('');
  };

  const removeLeaveDay = (id: string) => {
    setLeaveDays(prev => prev.filter(d => d.id !== id));
  };

  const updateDayType = (id: string, dayType: 'full' | 'first_half' | 'second_half') => {
    setLeaveDays(prev => prev.map(d => d.id === id ? { ...d, dayType } : d));
  };

  const createRequestMutation = useMutation({
    mutationFn: async (values: LeaveFormValues) => {
      if (!companyId || !employeeId) throw new Error('Missing context');
      if (leaveDays.length === 0) throw new Error('Please add at least one leave day');

      // Create the leave request
      const { data: request, error: requestError } = await supabase
        .from('leave_requests')
        .insert({
          company_id: companyId,
          employee_id: employeeId,
          leave_type_id: values.leave_type_id,
          start_date: sortedDates[0].date,
          end_date: sortedDates[sortedDates.length - 1].date,
          total_days: totalDays,
          reason: values.reason || null,
          status: 'pending',
          current_approval_level: 1,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create leave request days
      const daysToInsert = leaveDays.map(day => ({
        leave_request_id: request.id,
        company_id: companyId,
        date: day.date,
        day_type: day.dayType,
      }));

      const { error: daysError } = await supabase
        .from('leave_request_days')
        .insert(daysToInsert);

      if (daysError) throw daysError;

      // Add audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'leave_requests',
        action: 'create' as const,
        record_id: request.id,
        new_values: { request_id: request.id, days_count: leaveDays.length },
      }]);

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Leave request submitted');
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit leave request');
    },
  });

  const onSubmit = async (values: LeaveFormValues) => {
    // Pre-check balance (the mutation will also check, but this gives better UX)
    if (selectedLeaveTypeId && employeeId && totalDays > 0) {
      try {
        const result = await checkBalance.mutateAsync({
          employeeId,
          leaveTypeId: selectedLeaveTypeId,
          days: totalDays,
        });
        if (!result.has_balance) {
          toast.error(result.message || 'Insufficient leave balance');
          return;
        }
      } catch {
        // Continue even if balance check fails - the server will validate
      }
    }
    createRequestMutation.mutate(values);
  };

  // Quick add consecutive days - keeping for future use
  const _addDateRange = (start: string, end: string) => {
    const rangeStart = parseISO(start);
    const rangeEnd = parseISO(end);
    const newDays: LeaveDay[] = [];
    
    let currentDate = rangeStart;
    while (!isAfter(currentDate, rangeEnd)) {
      if (!isWeekend(currentDate)) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        if (!leaveDays.some(d => d.date === dateStr)) {
          newDays.push({
            id: crypto.randomUUID(),
            date: dateStr,
            dayType: 'full' as const,
          });
        }
      }
      currentDate = addDays(currentDate, 1);
    }
    
    setLeaveDays(prev => [...prev, ...newDays].sort((a, b) => a.date.localeCompare(b.date)));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="leave_type_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Leave Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {leaveTypes?.map((type) => {
                    const balance = balances?.find(b => b.leaveTypeId === type.id);
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{type.name}</span>
                          {balance && (
                            <span className="text-xs text-muted-foreground">
                              {balance.remaining} days left
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedBalance && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>
                <strong>{selectedBalance.leaveTypeName}:</strong>{' '}
                {selectedBalance.remaining} of {selectedBalance.allocated} days remaining
                {selectedBalance.pending > 0 && ` (${selectedBalance.pending} pending)`}
              </span>
            </div>
          </div>
        )}

        {/* Leave Days Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Leave Days *</FormLabel>
            <Badge variant="outline">{totalDays} day{totalDays !== 1 ? 's' : ''}</Badge>
          </div>

          {/* Add Date Input */}
          <div className="flex gap-2">
            <Input 
              type="date" 
              value={newDate} 
              onChange={(e) => setNewDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={addLeaveDay} disabled={!newDate}>
              <Plus className="h-4 w-4 mr-1" />
              Add Day
            </Button>
          </div>

          {/* Leave Days Table */}
          {leaveDays.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveDays.map((day) => (
                    <TableRow key={day.id}>
                      <TableCell>{format(parseISO(day.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{format(parseISO(day.date), 'EEEE')}</TableCell>
                      <TableCell>
                        <Select 
                          value={day.dayType} 
                          onValueChange={(v) => updateDayType(day.id, v as any)}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full Day</SelectItem>
                            <SelectItem value="first_half">First Half</SelectItem>
                            <SelectItem value="second_half">Second Half</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => removeLeaveDay(day.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {leaveDays.length === 0 && (
            <div className="text-center py-6 border border-dashed rounded-md text-muted-foreground">
              <p className="text-sm">No leave days added yet</p>
              <p className="text-xs mt-1">Add individual days using the date picker above</p>
            </div>
          )}
        </div>

        {/* Team conflict warning */}
        {startDate && endDate && (
          <TeamConflictWarning startDate={startDate} endDate={endDate} />
        )}

        {/* Warning if overdrawing */}
        {isOverdraw && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This request exceeds your available balance by{' '}
              <strong>{totalDays - selectedBalance.remaining} days</strong>. 
              It may be rejected or require special approval.
            </AlertDescription>
          </Alert>
        )}

        <FormField control={form.control} name="reason" render={({ field }) => (
          <FormItem>
            <FormLabel>Reason</FormLabel>
            <FormControl><Textarea {...field} placeholder="Optional reason for leave" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button 
            type="submit" 
            disabled={createRequestMutation.isPending || leaveDays.length === 0}
          >
            {createRequestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </div>
      </form>
    </Form>
  );
}
