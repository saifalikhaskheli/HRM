import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useLeaveTypes, useCreateLeaveRequest } from '@/hooks/useLeave';
import { useMyLeaveBalances } from '@/hooks/useLeaveBalances';
import { TeamConflictWarning } from './TeamConflictWarning';
import { differenceInBusinessDays, parseISO } from 'date-fns';

const leaveSchema = z.object({
  leave_type_id: z.string().min(1, 'Leave type is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  reason: z.string().optional(),
}).refine(data => new Date(data.end_date) >= new Date(data.start_date), {
  message: 'End date must be after start date',
  path: ['end_date'],
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

interface LeaveRequestFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function LeaveRequestForm({ onSuccess, onCancel }: LeaveRequestFormProps) {
  const { data: leaveTypes } = useLeaveTypes();
  const { data: balances } = useMyLeaveBalances();
  const createRequest = useCreateLeaveRequest();

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leave_type_id: '',
      start_date: '',
      end_date: '',
      reason: '',
    },
  });

  const selectedLeaveTypeId = form.watch('leave_type_id');
  const startDate = form.watch('start_date');
  const endDate = form.watch('end_date');
  
  const totalDays = startDate && endDate 
    ? Math.max(1, differenceInBusinessDays(parseISO(endDate), parseISO(startDate)) + 1)
    : 0;

  // Find balance for selected leave type
  const selectedBalance = balances?.find(b => b.leaveTypeId === selectedLeaveTypeId);
  const isOverdraw = selectedBalance && totalDays > selectedBalance.remaining;

  const onSubmit = async (values: LeaveFormValues) => {
    await createRequest.mutateAsync({
      leave_type_id: values.leave_type_id,
      start_date: values.start_date,
      end_date: values.end_date,
      total_days: totalDays,
      reason: values.reason || null,
    });
    onSuccess();
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

        {/* Show balance for selected type */}
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

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="start_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date *</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="end_date" render={({ field }) => (
            <FormItem>
              <FormLabel>End Date *</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {totalDays > 0 && (
          <p className="text-sm text-muted-foreground">Total: {totalDays} day{totalDays !== 1 ? 's' : ''}</p>
        )}

        {/* Team conflict warning - show who else is on leave */}
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
          <Button type="submit" disabled={createRequest.isPending}>
            {createRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </div>
      </form>
    </Form>
  );
}
